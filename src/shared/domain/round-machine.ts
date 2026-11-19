import type { OperatorAction, RoundState } from "./types";

/** Resultado de aplicar una acción a una ronda. */
export type TransitionResult =
  | { ok: true; state: RoundState }
  | { ok: false; reason: "INVALID_TRANSITION" };

/**
 * Transiciones válidas de la ronda, indexadas por estado y acción del operador.
 * Un estado sin entradas es terminal. La expiración del temporizador de última
 * llamada se representa con la acción CERRAR, que el sistema invoca al vencer el plazo.
 */
export const ROUND_TRANSITIONS: Readonly<
  Record<RoundState, Readonly<Partial<Record<OperatorAction, RoundState>>>>
> = {
  SCHEDULED: { OPEN: "OPEN" },
  OPEN: { LAST_CALL: "LAST_CALL" },
  LAST_CALL: { CLOSE: "CLOSED" },
  CLOSED: {
    ENABLE_VOTING: "VOTING",
    CANCEL_REFUND: "CANCELLED",
    CANCEL_SETTLE_1X: "CANCELLED",
  },
  VOTING: { REVEAL: "SETTLED" },
  SETTLED: {},
  CANCELLED: {},
};

/**
 * Aplica una acción del operador al estado vigente de la ronda. Rechaza las
 * acciones que no corresponden al estado. Las acciones SIGUIENTE, DESHACER y
 * MODO_MANUAL no modifican el estado de la ronda y se rechazan en esta función.
 */
export function nextState(state: RoundState, action: OperatorAction): TransitionResult {
  const target = ROUND_TRANSITIONS[state][action];

  if (target === undefined) {
    return { ok: false, reason: "INVALID_TRANSITION" };
  }

  return { ok: true, state: target };
}
