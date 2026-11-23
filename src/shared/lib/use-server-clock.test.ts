import { describe, expect, it } from "vitest";
import { phaseSecondsLeft, secondsUntil, serverNow, syncServerClock } from "./use-server-clock";

describe("server clock", () => {
  it("applies the offset between the phone and the server", () => {
    const received = Date.now();
    syncServerClock(new Date(received + 5000).toISOString(), received);
    expect(serverNow() - Date.now()).toBeGreaterThan(4900);
    syncServerClock(new Date().toISOString());
  });

  it("counts whole seconds up to a deadline and never below zero", () => {
    const now = Date.parse("2026-11-26T15:00:00.000Z");
    expect(secondsUntil("2026-11-26T15:00:59.200Z", now)).toBe(60);
    expect(secondsUntil("2026-11-26T14:59:00.000Z", now)).toBe(0);
    expect(secondsUntil(null, now)).toBeNull();
  });

  it("returns the frozen seconds while paused", () => {
    const clock = { serverTime: "", phaseEndsAt: null, paused: true, pausedSeconds: 42 };
    expect(phaseSecondsLeft(clock, 0)).toBe(42);
  });
});
