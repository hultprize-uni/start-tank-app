import { describe, expect, it } from "vitest";
import { errorInversionista } from "./investor.errors";

describe("errorInversionista", () => {
  it.each([
    ["MONTO_MINIMO", 422, "El monto mínimo de compra es 250 coins."],
    ["TOPE_RONDA_SUPERADO", 422, "Superas tu tope de esta ronda, que equivale al 30 % de tu saldo al abrirla."],
    ["SALDO_INSUFICIENTE", 422, "Tu saldo no alcanza para este monto."],
    ["RONDA_NO_ABIERTA", 409, "La ronda no está abierta para invertir."],
  ])("traduce %s a estado %i con mensaje en español", (codigo, estado, mensaje) => {
    expect(errorInversionista(codigo)).toEqual({ codigo, estado, mensaje });
  });

  it("asigna estado propio a los errores de cuenta y de ronda inexistente", () => {
    expect(errorInversionista("USUARIO_INACTIVO").estado).toBe(403);
    expect(errorInversionista("USUARIO_NO_EXISTE").estado).toBe(404);
    expect(errorInversionista("RONDA_NO_EXISTE").estado).toBe(409);
  });

  it("usa un mensaje genérico con estado 500 para códigos desconocidos", () => {
    const error = errorInversionista("CODIGO_NUEVO");

    expect(error.estado).toBe(500);
    expect(error.codigo).toBe("CODIGO_NUEVO");
    expect(error.mensaje).toBe("No fue posible completar la operación. Intenta de nuevo.");
  });

  it("no toma propiedades heredadas del objeto como códigos válidos", () => {
    expect(errorInversionista("constructor").estado).toBe(500);
  });
});
