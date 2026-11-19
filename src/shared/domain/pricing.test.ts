import { describe, expect, it } from "vitest";
import { livePrice } from "./pricing";

describe("livePrice", () => {
  it("devuelve el precio base cuando no hay monto acumulado", () => {
    expect(livePrice(0)).toBe(100);
  });

  it("sube una unidad por cada 2,000 coins acumulados", () => {
    expect(livePrice(2_000)).toBe(101);
    expect(livePrice(10_000)).toBe(105);
  });

  it("depende solo del monto acumulado y no del número de operaciones", () => {
    const total = 2_500;

    expect(livePrice(total)).toBe(livePrice(total));
    expect(livePrice(10 * 250)).toBe(livePrice(2_500));
  });

  it("limita el precio superior a 200", () => {
    expect(livePrice(1_000_000)).toBe(200);
    expect(livePrice(200_000)).toBe(200);
  });

  it("trata los montos negativos como cero", () => {
    expect(livePrice(-500)).toBe(100);
  });

  it("rechaza montos no finitos", () => {
    expect(() => livePrice(Number.NaN)).toThrow(RangeError);
    expect(() => livePrice(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
