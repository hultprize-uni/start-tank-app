import { describe, expect, it } from "vitest";
import { isMarketOpen, nextState } from "./round-machine";

describe("nextState", () => {
  it.each([
    ["SCHEDULED", "OPEN", "PITCH"],
    ["PITCH", "OPEN_MARKET", "OPEN"],
    ["PITCH", "RESTART_PHASE", "PITCH"],
    ["SETTLED", "RESTART_ROUND", "SCHEDULED"],
    ["VOTING", "RESTART_ROUND", "SCHEDULED"],
    ["OPEN", "LAST_CALL", "LAST_CALL"],
    ["OPEN", "CLOSE", "CLOSED"],
    ["LAST_CALL", "CLOSE", "CLOSED"],
    ["CLOSED", "ENABLE_VOTING", "VOTING"],
    ["VOTING", "REVEAL", "SETTLED"],
    ["VOTING", "CANCEL_REFUND", "CANCELLED"],
    ["OPEN", "CANCEL_SETTLE_1X", "SETTLED"],
    ["OPEN", "PAUSE", "OPEN"],
    ["VOTING", "ADD_MINUTE", "VOTING"],
  ] as const)("%s + %s -> %s", (state, action, target) => {
    expect(nextState(state, action)).toEqual({ ok: true, state: target });
  });

  it.each([
    ["SCHEDULED", "CLOSE"],
    ["CLOSED", "PAUSE"],
    ["SETTLED", "OPEN"],
    ["CANCELLED", "CANCEL_REFUND"],
    ["SCHEDULED", "CANCEL_REFUND"],
    ["PITCH", "LAST_CALL"],
    ["SCHEDULED", "RESTART_ROUND"],
    ["CLOSED", "RESTART_PHASE"],
  ] as const)("rejects %s + %s", (state, action) => {
    expect(nextState(state, action)).toEqual({ ok: false, reason: "INVALID_TRANSITION" });
  });
});

describe("isMarketOpen", () => {
  const now = 1_000_000;

  it("is open while the round is open and not paused", () => {
    expect(isMarketOpen("OPEN", false, null, now)).toBe(true);
    expect(isMarketOpen("OPEN", true, null, now)).toBe(false);
  });

  it("closes the last call at its deadline", () => {
    expect(isMarketOpen("LAST_CALL", false, now + 1, now)).toBe(true);
    expect(isMarketOpen("LAST_CALL", false, now, now)).toBe(false);
  });

  it("is closed in any other state", () => {
    expect(isMarketOpen("CLOSED", false, null, now)).toBe(false);
  });
});
