import { describe, expect, it } from "vitest";
import { DEMO_STARTUPS, formatCoins, marketFrame } from "./market-demo";

describe("formatCoins", () => {
  it("separa los miles con coma", () => {
    expect(formatCoins(6200)).toBe("6,200");
    expect(formatCoins(1234567)).toBe("1,234,567");
    expect(formatCoins(950)).toBe("950");
  });
});

describe("marketFrame", () => {
  it("es determinista para el mismo instante y startup", () => {
    expect(marketFrame(3, 1)).toEqual(marketFrame(3, 1));
  });

  it("formatea el precio con un decimal y la variación con signo", () => {
    const frame = marketFrame(0, 0);
    expect(frame.price).toMatch(/^\d+\.\d$/);
    expect(frame.delta).toMatch(/^\+-?\d+\.\d%$/);
  });

  it("produce veintitrés puntos dentro del área de la serie", () => {
    const { points } = marketFrame(5, 2);
    const pairs = points.split(" ").map((pair) => pair.split(",").map(Number));

    expect(pairs).toHaveLength(23);
    expect(pairs[0][0]).toBe(0);
    expect(pairs[pairs.length - 1][0]).toBe(100);
    for (const [, y] of pairs) {
      expect(y).toBeGreaterThanOrEqual(2);
      expect(y).toBeLessThanOrEqual(27);
    }
  });

  it("mantiene el número de inversores en el rango de la demostración", () => {
    for (let tick = 0; tick < 200; tick++) {
      const { investors } = marketFrame(tick, 0);
      expect(investors).toBeGreaterThanOrEqual(24);
      expect(investors).toBeLessThanOrEqual(69);
    }
  });

  it("expone tres startups de muestra", () => {
    expect(DEMO_STARTUPS.map((startup) => startup.name)).toEqual([
      "Qhali Agua",
      "Tarpuy",
      "Pétreo",
    ]);
  });
});
