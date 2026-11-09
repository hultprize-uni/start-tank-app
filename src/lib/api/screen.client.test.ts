import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ESTADO_INICIAL,
  RUTA_PANTALLA,
  consultarPantalla,
  iniciarSondeo,
  reducirEstado,
  segundosRestantesEnVivo,
} from "./screen.client";
import type { ScreenViewModel } from "./screen.types";

const RONDA = {
  numero: 4,
  startup: { nombre: "Aqua Viva", ods: { numero: 6, nombre: "Agua limpia y saneamiento" } },
};

const MERCADO: ScreenViewModel = {
  fase: "MERCADO",
  actualizadoEn: "2026-11-08T15:00:00.000Z",
  ronda: RONDA,
  precio: 120,
  acumulado: 4_000,
  inversoresUnicos: 18,
};

const ULTIMA_LLAMADA: ScreenViewModel = {
  fase: "ULTIMA_LLAMADA",
  actualizadoEn: "2026-11-08T15:00:00.000Z",
  ronda: RONDA,
  precio: 150,
  acumulado: 9_500,
  inversoresUnicos: 31,
  segundosRestantes: 60,
};

/** Respuesta JSON simulada con el estado HTTP indicado. */
function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });
}

describe("consultarPantalla", () => {
  it("consulta la ruta con GET, sin caché, y devuelve la lectura", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(respuestaJson(MERCADO));

    const resultado = await consultarPantalla(fetchImpl);

    expect(resultado).toEqual({ tipo: "lectura", vm: MERCADO });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(RUTA_PANTALLA);
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
  });

  it("reporta sin_rondas cuando el servidor responde 404", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(respuestaJson({ error: "SIN_RONDAS" }, 404));

    await expect(consultarPantalla(fetchImpl)).resolves.toEqual({ tipo: "sin_rondas" });
  });

  it("reporta error ante un fallo de red", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(consultarPantalla(fetchImpl)).resolves.toEqual({ tipo: "error" });
  });

  it("reporta error ante un estado HTTP de servidor", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(respuestaJson({}, 500));

    await expect(consultarPantalla(fetchImpl)).resolves.toEqual({ tipo: "error" });
  });

  it("reporta error ante una respuesta que no tiene la forma de un view model", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(respuestaJson({ fase: "DESCONOCIDA", actualizadoEn: "x" }));

    await expect(consultarPantalla(fetchImpl)).resolves.toEqual({ tipo: "error" });
  });
});

describe("reducirEstado", () => {
  it("conserva la última lectura cuando la red falla", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(respuestaJson(MERCADO))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    let estado = reducirEstado(ESTADO_INICIAL, await consultarPantalla(fetchImpl), 1_000);
    expect(estado.vm).toEqual(MERCADO);
    expect(estado.sinConexion).toBe(false);

    estado = reducirEstado(estado, await consultarPantalla(fetchImpl), 3_000);
    expect(estado.vm).toEqual(MERCADO);
    expect(estado.recibidoEn).toBe(1_000);
    expect(estado.sinConexion).toBe(true);
  });

  it("limpia la marca de conexión cuando una consulta vuelve a responder", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(respuestaJson(MERCADO));

    let estado = reducirEstado(ESTADO_INICIAL, await consultarPantalla(fetchImpl), 1_000);
    expect(estado.sinConexion).toBe(true);
    expect(estado.vm).toBeNull();

    estado = reducirEstado(estado, await consultarPantalla(fetchImpl), 3_000);
    expect(estado).toEqual({ vm: MERCADO, recibidoEn: 3_000, sinConexion: false });
  });

  it("limpia el view model cuando el evento no tiene rondas", () => {
    const previo = { vm: MERCADO, recibidoEn: 1_000, sinConexion: false };

    expect(reducirEstado(previo, { tipo: "sin_rondas" }, 2_000)).toEqual({
      vm: null,
      recibidoEn: 2_000,
      sinConexion: false,
    });
  });
});

describe("segundosRestantesEnVivo", () => {
  const vm = ULTIMA_LLAMADA as Extract<ScreenViewModel, { fase: "ULTIMA_LLAMADA" }>;
  const recibidoEn = Date.parse(vm.actualizadoEn);

  it("parte de los segundos recibidos y disminuye con el tiempo transcurrido", () => {
    expect(segundosRestantesEnVivo(vm, recibidoEn, recibidoEn)).toBe(60);
    expect(segundosRestantesEnVivo(vm, recibidoEn, recibidoEn + 15_000)).toBe(45);
  });

  it("no depende de la hora local del cliente", () => {
    const unaHoraAdelantada = recibidoEn + 3_600_000;

    expect(segundosRestantesEnVivo(vm, unaHoraAdelantada, unaHoraAdelantada + 15_000)).toBe(45);
  });

  it("limita el resultado entre 0 y la duración de la última llamada", () => {
    expect(segundosRestantesEnVivo(vm, recibidoEn, recibidoEn + 90_000)).toBe(0);
    expect(segundosRestantesEnVivo(vm, recibidoEn, recibidoEn - 5_000)).toBe(60);
  });
});

describe("iniciarSondeo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("consulta de inmediato y luego cada intervalo hasta detenerse", async () => {
    const consultar = vi.fn(async () => {});
    const detener = iniciarSondeo({ intervaloMs: 2_000, consultar });

    expect(consultar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(consultar).toHaveBeenCalledTimes(3);

    detener();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(consultar).toHaveBeenCalledTimes(3);
  });

  it("no inicia una consulta mientras la anterior sigue en curso", async () => {
    let liberar: () => void = () => {};
    const consultar = vi.fn(
      () =>
        new Promise<void>((resolver) => {
          liberar = resolver;
        }),
    );
    const detener = iniciarSondeo({ intervaloMs: 2_000, consultar });

    await vi.advanceTimersByTimeAsync(6_000);
    expect(consultar).toHaveBeenCalledTimes(1);

    liberar();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(consultar).toHaveBeenCalledTimes(2);
    detener();
  });
});
