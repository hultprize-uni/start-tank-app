import { describe, expect, it } from "vitest";
import { payoutPreview, roundCap, validateInvestment, type InvestmentRequest } from "./investment";
import { multiplierForScore } from "./verdict";

const base: InvestmentRequest = {
  amount: 1000,
  balance: 10000,
  alreadyInvested: false,
  roundOpen: true,
  paused: false,
};

describe("validateInvestment", () => {
  it("accepts a valid investment", () => {
    expect(validateInvestment(base)).toEqual({ ok: true });
  });

  it.each<[Partial<InvestmentRequest>, string]>([
    [{ amount: 249 }, "MONTO_MINIMO"],
    [{ roundOpen: false }, "RONDA_NO_ABIERTA"],
    [{ paused: true }, "MERCADO_EN_PAUSA"],
    [{ alreadyInvested: true }, "YA_INVIRTIO"],
    [{ amount: 3000.01 }, "TOPE_RONDA_SUPERADO"],
  ])("rejects %o with %s", (change, reason) => {
    expect(validateInvestment({ ...base, ...change })).toEqual({ ok: false, reason });
  });

  it("accepts exactly the 30 percent cap", () => {
    expect(validateInvestment({ ...base, amount: 3000 })).toEqual({ ok: true });
  });
});

describe("roundCap", () => {
  it("is 30 percent of the balance, rounded to cents", () => {
    expect(roundCap(10000)).toBe(3000);
    expect(roundCap(333.33)).toBe(100);
  });
});

describe("payoutPreview", () => {
  it("shows the payout for every jury score", () => {
    expect(payoutPreview(1000, multiplierForScore).map((row) => row.payout)).toEqual([
      200, 600, 1000, 1400, 1800,
    ]);
  });
});
