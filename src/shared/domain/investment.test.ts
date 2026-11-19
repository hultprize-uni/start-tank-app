import { describe, expect, it } from "vitest";
import { roundCap, validateInvestment } from "./investment";

const baseRequest = {
  amount: 250,
  balance: 10_000,
  investedInRound: 0,
  balanceAtOpen: 10_000,
  roundOpen: true,
};

describe("roundCap", () => {
  it("equivale al 30 por ciento del saldo al abrir la ronda", () => {
    expect(roundCap(10_000)).toBe(3_000);
    expect(roundCap(0)).toBe(0);
  });
});

describe("validateInvestment", () => {
  it("acepta una compra válida", () => {
    expect(validateInvestment(baseRequest)).toEqual({ ok: true });
  });

  it("acepta una compra que iguala el mínimo y el tope exacto", () => {
    expect(validateInvestment({ ...baseRequest, amount: 250 })).toEqual({ ok: true });
    expect(
      validateInvestment({ ...baseRequest, investedInRound: 2_750, amount: 250 }),
    ).toEqual({ ok: true });
  });

  it("rechaza compras cuando la ronda no está abierta", () => {
    expect(validateInvestment({ ...baseRequest, roundOpen: false })).toEqual({
      ok: false,
      reason: "RONDA_CERRADA",
    });
  });

  it("rechaza montos menores a 250 coins", () => {
    expect(validateInvestment({ ...baseRequest, amount: 249 })).toEqual({
      ok: false,
      reason: "MINIMO_NO_ALCANZADO",
    });
  });

  it("rechaza compras mayores al saldo disponible", () => {
    expect(validateInvestment({ ...baseRequest, amount: 1_000, balance: 900 })).toEqual({
      ok: false,
      reason: "INSUFFICIENT_BALANCE",
    });
  });

  it("rechaza compras que superan el tope de la ronda", () => {
    expect(
      validateInvestment({ ...baseRequest, investedInRound: 2_750, amount: 251 }),
    ).toEqual({ ok: false, reason: "TOPE_DE_RONDA_EXCEDIDO" });
  });

  it("calcula el tope con el saldo al abrir y no con el saldo actual", () => {
    const result = validateInvestment({
      ...baseRequest,
      balance: 5_000,
      balanceAtOpen: 10_000,
      investedInRound: 2_900,
      amount: 250,
    });

    expect(result).toEqual({ ok: false, reason: "TOPE_DE_RONDA_EXCEDIDO" });
  });
});
