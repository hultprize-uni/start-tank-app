import { describe, expect, it } from "vitest";
import {
  normalizeFunctionResult,
  parseSdg,
  toActionName,
  toDbAction,
  toDbDecision,
  toDecision,
  toErrorCode,
  toRoundState,
} from "./values";


describe("parseSdg", () => {
  it("extrae el número y el nombre oficial del ODS", () => {
    expect(parseSdg("ODS 6")).toEqual({
      number: 6,
      name: "Agua limpia y saneamiento",
    });
  });

  it("devuelve número cero y nombre vacío cuando el texto no contiene un ODS", () => {
    expect(parseSdg(null)).toEqual({ number: 0, name: "" });
  });
});

describe("toRoundState", () => {
  it("traduce los estados de la base de datos al dominio", () => {
    expect(toRoundState("PROGRAMADA")).toBe("SCHEDULED");
    expect(toRoundState("ABIERTA")).toBe("OPEN");
    expect(toRoundState("ULTIMA_LLAMADA")).toBe("LAST_CALL");
    expect(toRoundState("CERRADA")).toBe("CLOSED");
    expect(toRoundState("EN_VOTACION")).toBe("VOTING");
    expect(toRoundState("LIQUIDADA")).toBe("SETTLED");
    expect(toRoundState("ANULADA")).toBe("CANCELLED");
  });

  it("lanza un error ante un estado desconocido", () => {
    expect(() => toRoundState("OTRO")).toThrow(/OTRO/);
  });
});

describe("decisiones", () => {
  it("traduce las decisiones en ambos sentidos", () => {
    expect(toDecision("RESPALDA")).toBe("BACK");
    expect(toDecision("RECHAZA")).toBe("REJECT");
    expect(toDecision("SE_ABSTIENE")).toBe("ABSTAIN");
    expect(toDbDecision("BACK")).toBe("RESPALDA");
    expect(toDbDecision("REJECT")).toBe("RECHAZA");
    expect(toDbDecision("ABSTAIN")).toBe("SE_ABSTIENE");
  });

  it("lanza un error ante una decisión desconocida", () => {
    expect(() => toDecision("TAL_VEZ")).toThrow(/TAL_VEZ/);
  });
});

describe("acciones", () => {
  it("traduce las acciones en ambos sentidos y conserva las desconocidas", () => {
    expect(toDbAction("CANCEL_SETTLE_1X")).toBe("ANULAR_LIQUIDAR_1X");
    expect(toActionName("HABILITAR_VOTO")).toBe("ENABLE_VOTING");
    expect(toActionName("ACCION_NUEVA")).toBe("ACCION_NUEVA");
  });
});

describe("normalizeFunctionResult", () => {
  it("traduce el código de error y conserva los códigos desconocidos", () => {
    expect(toErrorCode("TOPE_RONDA_SUPERADO")).toBe("ROUND_CAP_EXCEEDED");
    expect(toErrorCode("CODIGO_NUEVO")).toBe("CODIGO_NUEVO");
  });

  it("traduce el error, el saldo y el estado de la ronda", () => {
    expect(normalizeFunctionResult({ ok: false, error: "VOTO_DUPLICADO" })).toEqual({
      ok: false,
      error: "DUPLICATE_VOTE",
    });
    expect(normalizeFunctionResult({ ok: false, error: "SALDO_INSUFICIENTE", saldo: "900" })).toEqual({
      ok: false,
      error: "INSUFFICIENT_BALANCE",
      balance: 900,
    });
    expect(normalizeFunctionResult({ ok: true, estado: "CERRADA" })).toEqual({
      ok: true,
      state: "CLOSED",
    });
    expect(normalizeFunctionResult({ ok: true, saldo: null })).toEqual({ ok: true, balance: null });
  });
});
