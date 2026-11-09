import { describe, expect, it, vi } from "vitest";
import {
  type FuncionFetch,
  invertirMonto,
  obtenerEstadoInversionista,
  RUTA_ESTADO_INVERSIONISTA,
  RUTA_INVERTIR_INVERSIONISTA,
  SIN_SESION,
} from "./investor.client";
import type { InvestorViewModel } from "./investor.types";

/** Respuesta JSON simulada con el estado HTTP indicado. */
function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });
}

const vistaEjemplo: InvestorViewModel = {
  phase: "open",
  round: { number: 2, total: 5 },
  startup: { name: "Nodo Solar", ods: "ODS 7 · Energía asequible y no contaminante", description: "" },
  wallet: { balance: 9_000, investedInRound: 0, roundCap: 3_000 },
  market: { price: 110, priceChange: 10, totalRaised: 2_200, investorCount: 9 },
  countdownSeconds: null,
  verdict: null,
  standing: null,
};

describe("obtenerEstadoInversionista", () => {
  it("devuelve la señal de sesión ausente ante un 401", async () => {
    const fetchFn = vi.fn<FuncionFetch>(async () => respuestaJson({ error: "SIN_SESION" }, 401));

    await expect(obtenerEstadoInversionista(fetchFn)).resolves.toBe(SIN_SESION);
    expect(fetchFn).toHaveBeenCalledWith(RUTA_ESTADO_INVERSIONISTA, { cache: "no-store" });
  });

  it("devuelve el view model tal como lo entrega la API", async () => {
    const fetchFn = vi.fn<FuncionFetch>(async () => respuestaJson(vistaEjemplo));

    await expect(obtenerEstadoInversionista(fetchFn)).resolves.toEqual(vistaEjemplo);
  });

  it("lanza error ante fallos del servidor para conservar el último estado válido", async () => {
    const fetchFn = vi.fn<FuncionFetch>(async () => respuestaJson({ error: "X" }, 500));

    await expect(obtenerEstadoInversionista(fetchFn)).rejects.toThrow("500");
  });
});

describe("invertirMonto", () => {
  it("envía solo el monto en el cuerpo y devuelve éxito", async () => {
    const fetchFn = vi.fn<FuncionFetch>(async () => respuestaJson({ ok: true, saldo: 9_700 }));

    const resultado = await invertirMonto(300, fetchFn);

    expect(resultado).toEqual({ ok: true });
    const [ruta, init] = fetchFn.mock.calls[0];
    expect(ruta).toBe(RUTA_INVERTIR_INVERSIONISTA);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ monto: 300 });
  });

  it("devuelve el mensaje en español que informa la API", async () => {
    const fetchFn = vi.fn<FuncionFetch>(async () =>
      respuestaJson({ error: "MONTO_MINIMO", mensaje: "El monto mínimo de compra es 250 coins." }, 422),
    );

    await expect(invertirMonto(100, fetchFn)).resolves.toEqual({
      ok: false,
      mensaje: "El monto mínimo de compra es 250 coins.",
    });
  });

  it("usa un mensaje genérico cuando la respuesta de error no es JSON", async () => {
    const fetchFn = vi.fn<FuncionFetch>(async () => new Response("<html>", { status: 502 }));

    const resultado = await invertirMonto(300, fetchFn);

    expect(resultado).toEqual({
      ok: false,
      mensaje: "No fue posible registrar la inversión. Intenta de nuevo.",
    });
  });

  it("devuelve un mensaje de red cuando la solicitud no se completa", async () => {
    const fetchFn = vi.fn<FuncionFetch>(async () => {
      throw new TypeError("Failed to fetch");
    });

    const resultado = await invertirMonto(300, fetchFn);

    expect(resultado).toEqual({
      ok: false,
      mensaje: "No fue posible conectar con el servidor. Intenta de nuevo.",
    });
  });
});
