import { describe, expect, it } from "vitest";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { parseConfigRows } from "./config";

describe("parseConfigRows", () => {
  it("keeps the defaults when the table is empty", () => {
    expect(parseConfigRows([])).toEqual({
      config: { ...EVENT_CONFIG },
      flags: { eventStarted: false, manualMode: false },
    });
  });

  it("overrides numbers, converts the phone delay to milliseconds and reads the flags", () => {
    const { config, flags } = parseConfigRows([
      { clave: "compra_minima", valor: "500" },
      { clave: "retraso_telefono_s", valor: "2" },
      { clave: "modo_manual", valor: "true" },
      { clave: "tope_ronda", valor: "no es número" },
    ]);
    expect(config.minInvestment).toBe(500);
    expect(config.phoneRevealDelayMs).toBe(2000);
    expect(config.roundCapRatio).toBe(EVENT_CONFIG.roundCapRatio);
    expect(flags).toEqual({ eventStarted: false, manualMode: true });
  });
});
