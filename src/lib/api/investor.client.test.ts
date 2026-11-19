import { describe, expect, it, vi } from "vitest";
import {
  type FetchFunction,
  investAmount,
  fetchParticipantState,
  PARTICIPANT_STATE_ROUTE,
  PARTICIPANT_INVEST_ROUTE,
  NO_SESSION,
} from "./investor.client";
import type { InvestorViewModel } from "./investor.types";

/** Respuesta JSON simulada con el estado HTTP indicado. */
function jsonResponse(body: unknown, state = 200): Response {
  return new Response(JSON.stringify(body), {
    status: state,
    headers: { "Content-Type": "application/json" },
  });
}

const sampleView: InvestorViewModel = {
  phase: "open",
  round: { number: 2, total: 5 },
  startup: { name: "Nodo Solar", sdg: "ODS 7 · Energía asequible y no contaminante", description: "" },
  wallet: { balance: 9_000, investedInRound: 0, roundCap: 3_000 },
  market: { price: 110, priceChange: 10, totalRaised: 2_200, investorCount: 9 },
  countdownSeconds: null,
  verdict: null,
  standing: null,
};

describe("obtenerEstadoInversionista", () => {
  it("devuelve la señal de sesión ausente ante un 401", async () => {
    const fetchFn = vi.fn<FetchFunction>(async () => jsonResponse({ error: "NO_SESSION" }, 401));

    await expect(fetchParticipantState(fetchFn)).resolves.toBe(NO_SESSION);
    expect(fetchFn).toHaveBeenCalledWith(PARTICIPANT_STATE_ROUTE, { cache: "no-store" });
  });

  it("devuelve el view model tal como lo entrega la API", async () => {
    const fetchFn = vi.fn<FetchFunction>(async () => jsonResponse(sampleView));

    await expect(fetchParticipantState(fetchFn)).resolves.toEqual(sampleView);
  });

  it("lanza error ante fallos del servidor para conservar el último estado válido", async () => {
    const fetchFn = vi.fn<FetchFunction>(async () => jsonResponse({ error: "X" }, 500));

    await expect(fetchParticipantState(fetchFn)).rejects.toThrow("500");
  });
});

describe("invertirMonto", () => {
  it("envía solo el monto en el cuerpo y devuelve éxito", async () => {
    const fetchFn = vi.fn<FetchFunction>(async () => jsonResponse({ ok: true, saldo: 9_700 }));

    const result = await investAmount(300, fetchFn);

    expect(result).toEqual({ ok: true });
    const [route, init] = fetchFn.mock.calls[0];
    expect(route).toBe(PARTICIPANT_INVEST_ROUTE);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ amount: 300 });
  });

  it("devuelve el mensaje en español que informa la API", async () => {
    const fetchFn = vi.fn<FetchFunction>(async () =>
      jsonResponse({ error: "BELOW_MINIMUM", message: "El monto mínimo de compra es 250 coins." }, 422),
    );

    await expect(investAmount(100, fetchFn)).resolves.toEqual({
      ok: false,
      message: "El monto mínimo de compra es 250 coins.",
    });
  });

  it("usa un mensaje genérico cuando la respuesta de error no es JSON", async () => {
    const fetchFn = vi.fn<FetchFunction>(async () => new Response("<html>", { status: 502 }));

    const result = await investAmount(300, fetchFn);

    expect(result).toEqual({
      ok: false,
      message: "No fue posible registrar la inversión. Intenta de nuevo.",
    });
  });

  it("devuelve un mensaje de red cuando la solicitud no se completa", async () => {
    const fetchFn = vi.fn<FetchFunction>(async () => {
      throw new TypeError("Failed to fetch");
    });

    const result = await investAmount(300, fetchFn);

    expect(result).toEqual({
      ok: false,
      message: "No fue posible conectar con el servidor. Intenta de nuevo.",
    });
  });
});
