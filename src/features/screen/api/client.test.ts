import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INITIAL_STATE,
  fetchScreen,
  startPolling,
  reduceState,
  liveSecondsRemaining,
} from "./client";
import { API_ROUTES } from "@/shared/lib/api-routes";
import type { ScreenViewModel } from "../types";

const RONDA = {
  number: 4,
  startup: { name: "Aqua Viva", sdg: { number: 6, name: "Agua limpia y saneamiento" } },
};

const MARKET: ScreenViewModel = {
  phase: "MARKET",
  updatedAt: "2026-11-08T15:00:00.000Z",
  round: RONDA,
  price: 120,
  accumulated: 4_000,
  uniqueInvestors: 18,
};

const LAST_CALL: ScreenViewModel = {
  phase: "LAST_CALL",
  updatedAt: "2026-11-08T15:00:00.000Z",
  round: RONDA,
  price: 150,
  accumulated: 9_500,
  uniqueInvestors: 31,
  secondsRemaining: 60,
};

/** Respuesta JSON simulada con el estado HTTP indicado. */
function jsonResponse(body: unknown, state = 200): Response {
  return new Response(JSON.stringify(body), {
    status: state,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchScreen", () => {
  it("consulta la ruta con GET, sin caché, y devuelve la lectura", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(MARKET));

    const result = await fetchScreen(fetchImpl);

    expect(result).toEqual({ kind: "reading", vm: MARKET });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(API_ROUTES.screen.state);
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
  });

  it("reporta sin_rondas cuando el servidor responde 404", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: "NO_ROUNDS" }, 404));

    await expect(fetchScreen(fetchImpl)).resolves.toEqual({ kind: "no_rounds" });
  });

  it("reporta error ante un fallo de red", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchScreen(fetchImpl)).resolves.toEqual({ kind: "error" });
  });

  it("reporta error ante un estado HTTP de servidor", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 500));

    await expect(fetchScreen(fetchImpl)).resolves.toEqual({ kind: "error" });
  });

  it("reporta error ante una respuesta que no tiene la forma de un view model", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ phase: "DESCONOCIDA", updatedAt: "x" }));

    await expect(fetchScreen(fetchImpl)).resolves.toEqual({ kind: "error" });
  });
});

describe("reduceState", () => {
  it("conserva la última lectura cuando la red falla", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(MARKET))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    let state = reduceState(INITIAL_STATE, await fetchScreen(fetchImpl), 1_000);
    expect(state.vm).toEqual(MARKET);
    expect(state.offline).toBe(false);

    state = reduceState(state, await fetchScreen(fetchImpl), 3_000);
    expect(state.vm).toEqual(MARKET);
    expect(state.receivedAt).toBe(1_000);
    expect(state.offline).toBe(true);
  });

  it("limpia la marca de conexión cuando una consulta vuelve a responder", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(MARKET));

    let state = reduceState(INITIAL_STATE, await fetchScreen(fetchImpl), 1_000);
    expect(state.offline).toBe(true);
    expect(state.vm).toBeNull();

    state = reduceState(state, await fetchScreen(fetchImpl), 3_000);
    expect(state).toEqual({ vm: MARKET, receivedAt: 3_000, offline: false });
  });

  it("limpia el view model cuando el evento no tiene rondas", () => {
    const prior = { vm: MARKET, receivedAt: 1_000, offline: false };

    expect(reduceState(prior, { kind: "no_rounds" }, 2_000)).toEqual({
      vm: null,
      receivedAt: 2_000,
      offline: false,
    });
  });
});

describe("liveSecondsRemaining", () => {
  const vm = LAST_CALL as Extract<ScreenViewModel, { phase: "LAST_CALL" }>;
  const receivedAt = Date.parse(vm.updatedAt);

  it("parte de los segundos recibidos y disminuye con el tiempo transcurrido", () => {
    expect(liveSecondsRemaining(vm, receivedAt, receivedAt)).toBe(60);
    expect(liveSecondsRemaining(vm, receivedAt, receivedAt + 15_000)).toBe(45);
  });

  it("no depende de la hora local del cliente", () => {
    const oneHourAhead = receivedAt + 3_600_000;

    expect(liveSecondsRemaining(vm, oneHourAhead, oneHourAhead + 15_000)).toBe(45);
  });

  it("limita el resultado entre 0 y la duración de la última llamada", () => {
    expect(liveSecondsRemaining(vm, receivedAt, receivedAt + 90_000)).toBe(0);
    expect(liveSecondsRemaining(vm, receivedAt, receivedAt - 5_000)).toBe(60);
  });
});

describe("startPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("consulta de inmediato y luego cada intervalo hasta detenerse", async () => {
    const poll = vi.fn(async () => {});
    const stop = startPolling({ intervalMs: 2_000, poll: poll });

    expect(poll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(poll).toHaveBeenCalledTimes(3);

    stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it("no inicia una consulta mientras la anterior sigue en curso", async () => {
    let release: () => void = () => {};
    const poll = vi.fn(
      () =>
        new Promise<void>((resolver) => {
          release = resolver;
        }),
    );
    const stop = startPolling({ intervalMs: 2_000, poll: poll });

    await vi.advanceTimersByTimeAsync(6_000);
    expect(poll).toHaveBeenCalledTimes(1);

    release();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(poll).toHaveBeenCalledTimes(2);
    stop();
  });
});
