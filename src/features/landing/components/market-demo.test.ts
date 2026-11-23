import { describe, expect, it } from "vitest";
import { marketFrame } from "./market-demo";

describe("marketFrame", () => {
  it("is deterministic for the same tick", () => {
    expect(marketFrame(3)).toEqual(marketFrame(3));
  });

  it("raises the price with every tick until the curve restarts", () => {
    const first = Number(marketFrame(0).price);
    const later = Number(marketFrame(4).price);
    expect(first).toBeGreaterThan(100);
    expect(later).toBeGreaterThan(first);
    expect(marketFrame(10)).toEqual(marketFrame(0));
  });

  it("reports the change against the base price of 100", () => {
    const frame = marketFrame(2);
    expect(Number(frame.delta)).toBeCloseTo(Number(frame.price) - 100, 1);
  });

  it("closes the area under the line", () => {
    expect(marketFrame(0).area.endsWith(",30 0,30")).toBe(true);
  });
});
