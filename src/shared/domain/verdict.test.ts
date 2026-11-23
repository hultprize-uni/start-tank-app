import { describe, expect, it } from "vitest";
import { calcScoreVerdict, juryFraction, juryScore, multiplierForScore } from "./verdict";

describe("multiplierForScore", () => {
  it.each([
    [1, 0.2],
    [2, 0.6],
    [3, 1],
    [4, 1.4],
    [5, 1.8],
    [4.25, 1.5],
    [3.3333, 1.133],
  ])("maps a score of %f to %f", (score, multiplier) => {
    expect(multiplierForScore(score)).toBe(multiplier);
  });
});

describe("juryFraction", () => {
  it("is 0 at the minimum score and 1 at the maximum", () => {
    expect(juryFraction(1)).toBe(0);
    expect(juryFraction(3)).toBe(0.5);
    expect(juryFraction(5)).toBe(1);
  });
});

describe("juryScore", () => {
  it("averages notes with equal weights", () => {
    const notes = [5, 4, 3, 4].map((value) => ({ value, weight: 0.25 }));
    expect(juryScore(notes)).toBe(4);
  });

  it("weights the notes by criterion weight", () => {
    const notes = [
      { value: 5, weight: 0.7 },
      { value: 1, weight: 0.1 },
      { value: 1, weight: 0.1 },
      { value: 1, weight: 0.1 },
    ];
    expect(juryScore(notes)).toBe(3.8);
  });

  it("rejects a verdict without weight", () => {
    expect(() => juryScore([])).toThrow(RangeError);
  });
});

describe("calcScoreVerdict", () => {
  it("averages the jurors who did not abstain", () => {
    expect(calcScoreVerdict([4, 4, 2, null])).toEqual({ score: 3.3333, voters: 3, multiplier: 1.133 });
  });

  it("returns null when every juror abstains", () => {
    expect(calcScoreVerdict([null, null])).toBeNull();
  });
});
