import { describe, expect, it } from "vitest";
import { formatCoins, formatMultiplier, formatPriceChange, formatSignedCoins } from "./format";
import { getInvestmentIssue, getMarketPrice, getMultiplier, getRoundCap } from "./rules";

describe("formatCoins", () => {
  it("redondea y separa miles con coma", () => {
    expect(formatCoins(12_480.4)).toBe("12,480");
    expect(formatCoins(0)).toBe("0");
  });
});

describe("formatSignedCoins", () => {
  it("antepone el signo a ganancias y pérdidas", () => {
    expect(formatSignedCoins(200)).toBe("+200");
    expect(formatSignedCoins(-240)).toBe("−240");
    expect(formatSignedCoins(0)).toBe("0");
  });
});

describe("formatPriceChange", () => {
  it("indica la variación del precio con flecha y signo", () => {
    expect(formatPriceChange(10)).toBe("▲ +10");
    expect(formatPriceChange(-4)).toBe("▼ −4");
    expect(formatPriceChange(0)).toBe("= 0");
  });
});

describe("formatMultiplier", () => {
  it("muestra un decimal seguido de x", () => {
    expect(formatMultiplier(1.4)).toBe("1.4x");
    expect(formatMultiplier(1)).toBe("1.0x");
  });
});

describe("reglas del portal", () => {
  it("calcula el tope de la ronda como 30 % del saldo al abrir", () => {
    expect(getRoundCap(10_000)).toBe(3_000);
    expect(getRoundCap(9_999)).toBe(2_999);
  });

  it("acota el precio entre 50 y 200 según el monto acumulado", () => {
    expect(getMarketPrice(0)).toBe(100);
    expect(getMarketPrice(2_000)).toBe(101);
    expect(getMarketPrice(1_000_000)).toBe(200);
  });

  it("calcula el multiplicador sin contar abstenciones en el denominador", () => {
    expect(getMultiplier(4, 4)).toBeCloseTo(1.8);
    expect(getMultiplier(0, 0)).toBeCloseTo(0.2);
    expect(getMultiplier(2, 3)).toBeCloseTo(0.2 + 1.6 * (2 / 3));
  });

  it("distingue monto bajo el mínimo, tope superado y saldo insuficiente", () => {
    expect(getInvestmentIssue({ amount: 249, balance: 9_000, remainingCap: 3_000 })).toBe("below-min");
    expect(getInvestmentIssue({ amount: 300, balance: 9_000, remainingCap: 200 })).toBe("above-cap");
    expect(getInvestmentIssue({ amount: 300, balance: 200, remainingCap: 3_000 })).toBe("above-balance");
    expect(getInvestmentIssue({ amount: 250, balance: 9_000, remainingCap: 250 })).toBeNull();
  });
});
