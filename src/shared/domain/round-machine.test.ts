import { describe, expect, it } from "vitest";
import { nextState, ROUND_TRANSITIONS } from "./round-machine";
import type { OperatorAction, RoundState } from "./types";

const ACTIONS: readonly OperatorAction[] = [
  "OPEN",
  "LAST_CALL",
  "CLOSE",
  "ENABLE_VOTING",
  "REVEAL",
  "NEXT",
  "CANCEL_REFUND",
  "CANCEL_SETTLE_1X",
  "UNDO",
  "MANUAL_MODE",
];

describe("nextState", () => {
  it("recorre el ciclo completo de una ronda liquidada", () => {
    const steps: [RoundState, OperatorAction, RoundState][] = [
      ["SCHEDULED", "OPEN", "OPEN"],
      ["OPEN", "LAST_CALL", "LAST_CALL"],
      ["LAST_CALL", "CLOSE", "CLOSED"],
      ["CLOSED", "ENABLE_VOTING", "VOTING"],
      ["VOTING", "REVEAL", "SETTLED"],
    ];

    for (const [from, action, expected] of steps) {
      expect(nextState(from, action)).toEqual({ ok: true, state: expected });
    }
  });

  it("permite anular una ronda cerrada con cualquiera de las dos modalidades", () => {
    expect(nextState("CLOSED", "CANCEL_REFUND")).toEqual({ ok: true, state: "CANCELLED" });
    expect(nextState("CLOSED", "CANCEL_SETTLE_1X")).toEqual({ ok: true, state: "CANCELLED" });
  });

  it("rechaza revelar antes de que la ronda entre en votación", () => {
    expect(nextState("OPEN", "REVEAL")).toEqual({
      ok: false,
      reason: "INVALID_TRANSITION",
    });
  });

  it("rechaza anular una ronda que ya está en votación", () => {
    expect(nextState("VOTING", "CANCEL_REFUND")).toEqual({
      ok: false,
      reason: "INVALID_TRANSITION",
    });
  });

  it("rechaza cualquier acción sobre estados terminales", () => {
    for (const state of ["SETTLED", "CANCELLED"] as const) {
      for (const action of ACTIONS) {
        expect(nextState(state, action)).toEqual({
          ok: false,
          reason: "INVALID_TRANSITION",
        });
      }
    }
  });

  it("rechaza las acciones que no modifican el estado de la ronda", () => {
    for (const action of ["NEXT", "UNDO", "MANUAL_MODE"] as const) {
      expect(nextState("CLOSED", action)).toEqual({
        ok: false,
        reason: "INVALID_TRANSITION",
      });
    }
  });

  it("solo acepta las transiciones declaradas en la tabla", () => {
    const states = Object.keys(ROUND_TRANSITIONS) as RoundState[];

    for (const state of states) {
      for (const action of ACTIONS) {
        const declared = ROUND_TRANSITIONS[state][action];
        const result = nextState(state, action);

        if (declared === undefined) {
          expect(result.ok).toBe(false);
        } else {
          expect(result).toEqual({ ok: true, state: declared });
        }
      }
    }
  });
});
