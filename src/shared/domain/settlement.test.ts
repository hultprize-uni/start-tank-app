import { describe, expect, it } from "vitest";
import { applySettlement, settle } from "./settlement";

describe("settle", () => {
  it("calcula 2,000 coins con 3 de 4 respaldos como 2,800 coins", () => {
    expect(settle(2_000, 1.4)).toBe(2_800);
  });

  it("calcula 2,000 coins con 1 de 4 respaldos como 1,200 coins", () => {
    expect(settle(2_000, 0.6)).toBe(1_200);
  });

  it("devuelve el monto sin cambios con multiplicador 1.0x", () => {
    expect(settle(250, 1)).toBe(250);
  });

  it("redondea el resultado a centavos", () => {
    expect(settle(100, 1 / 3)).toBe(33.33);
  });
});

describe("applySettlement", () => {
  it("acredita el retorno al saldo que quedó después de la compra", () => {
    // Saldo inicial 10,000; compra de 2,000 deja 8,000; ronda con 1.4x acredita 2,800.
    expect(applySettlement(8_000, 2_000, 1.4)).toBe(10_800);
  });

  it("reduce el saldo cuando el multiplicador es menor a 1.0x", () => {
    expect(applySettlement(8_000, 2_000, 0.2)).toBe(8_400);
  });
});
