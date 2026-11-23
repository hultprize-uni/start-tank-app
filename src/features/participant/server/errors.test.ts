import { describe, expect, it } from "vitest";
import { participantError } from "./errors";

describe("participantError", () => {
  it.each([
    ["BELOW_MINIMUM", 422, "El monto mínimo es 250 coins."],
    ["ROUND_CAP_EXCEEDED", 422, "Superas tu tope de esta ronda: 30 % de tu saldo."],
    ["INSUFFICIENT_BALANCE", 422, "Tu saldo no alcanza para este monto."],
    ["ROUND_NOT_OPEN", 409, "El mercado ya cerró."],
  ])("traduce %s a estado %i con mensaje en español", (code, state, message) => {
    expect(participantError(code)).toEqual({ code, status: state, message });
  });

  it("asigna estado propio a los errores de cuenta y de ronda inexistente", () => {
    expect(participantError("ALREADY_INVESTED").status).toBe(409);
    expect(participantError("USER_NOT_FOUND").status).toBe(404);
    expect(participantError("ROUND_NOT_FOUND").status).toBe(409);
  });

  it("usa un mensaje genérico con estado 500 para códigos desconocidos", () => {
    const error = participantError("CODIGO_NUEVO");

    expect(error.status).toBe(500);
    expect(error.code).toBe("CODIGO_NUEVO");
    expect(error.message).toBe("No fue posible completar la operación. Intenta de nuevo.");
  });

  it("no toma propiedades heredadas del objeto como códigos válidos", () => {
    expect(participantError("constructor").status).toBe(500);
  });
});
