import { describe, expect, it } from "vitest";
import { bestEye, countHits, isHit, pickWinner, startupScore } from "./scoring";

describe("startupScore", () => {
  it("weights the jury 60 percent and the investors 40 percent", () => {
    expect(startupScore(0.75, 0.25)).toBeCloseTo(0.55);
  });
});

describe("pickWinner", () => {
  it("picks the highest final score", () => {
    const winner = pickWinner([
      { id: "a", fraction: 0.5, investorPct: 0.2 },
      { id: "b", fraction: 0.75, investorPct: 0.25 },
    ]);
    expect(winner?.id).toBe("b");
  });

  it("breaks a tie with the jury fraction", () => {
    const winner = pickWinner([
      { id: "a", fraction: 0.4, investorPct: 0.6 },
      { id: "b", fraction: 0.6, investorPct: 0.3 },
    ]);
    expect(winner?.id).toBe("b");
  });

  it("returns undefined for an empty list", () => {
    expect(pickWinner([])).toBeUndefined();
  });
});

describe("hits", () => {
  it("counts only multipliers above 1.0", () => {
    expect(isHit(1)).toBe(false);
    expect(isHit(1.1)).toBe(true);
    expect(countHits([0.2, 1, 1.4, 1.8])).toBe(2);
  });

  it("finds the attendee with most hits, first on ties", () => {
    expect(
      bestEye([
        { id: "a", investmentMultipliers: [1.4] },
        { id: "b", investmentMultipliers: [1.4, 1.8] },
        { id: "c", investmentMultipliers: [1.2, 1.6] },
      ]),
    ).toEqual({ id: "b", hits: 2 });
  });
});
