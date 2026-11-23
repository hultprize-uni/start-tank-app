import type { OperatorAction, RoundState } from "./types";

/** Resultado de aplicar una acción a una ronda. */
export type TransitionResult =
  | { ok: true; state: RoundState }
  | { ok: false; reason: "INVALID_TRANSITION" };

const CANCELS = { CANCEL_REFUND: "CANCELLED", CANCEL_SETTLE_1X: "SETTLED" } as const;

/**
 * Transiciones válidas, igual que fn_accion_operador v2. La última llamada también se cierra sola
 * al vencer (fn_cerrar_ultima_llamada_vencida), lo que equivale a CLOSE. PAUSE, RESUME y
 * ADD_MINUTE no cambian el estado: solo el cronómetro.
 */
export const ROUND_TRANSITIONS: Readonly<
  Record<RoundState, Readonly<Partial<Record<OperatorAction, RoundState>>>>
> = {
  SCHEDULED: { OPEN: "OPEN" },
  OPEN: { LAST_CALL: "LAST_CALL", CLOSE: "CLOSED", ...CANCELS },
  LAST_CALL: { CLOSE: "CLOSED", ...CANCELS },
  CLOSED: { ENABLE_VOTING: "VOTING", ...CANCELS },
  VOTING: { REVEAL: "SETTLED", ...CANCELS },
  SETTLED: {},
  CANCELLED: {},
};

/** Estados con cronómetro, en los que el conductor puede pausar y sumar un minuto. */
export const TIMED_STATES: ReadonlySet<RoundState> = new Set(["OPEN", "LAST_CALL", "VOTING"]);

/** Aplica una acción del operador. Las acciones de cronómetro conservan el estado. */
export function nextState(state: RoundState, action: OperatorAction): TransitionResult {
  if (action === "PAUSE" || action === "RESUME" || action === "ADD_MINUTE") {
    return TIMED_STATES.has(state) ? { ok: true, state } : { ok: false, reason: "INVALID_TRANSITION" };
  }
  const target = ROUND_TRANSITIONS[state][action];
  return target === undefined ? { ok: false, reason: "INVALID_TRANSITION" } : { ok: true, state: target };
}

/**
 * Indica si el mercado acepta inversiones en este instante: ronda abierta o en última llamada,
 * sin pausa y, en la última llamada, antes del vencimiento.
 */
export function isMarketOpen(
  state: RoundState,
  paused: boolean,
  phaseEndsAt: number | null,
  now: number,
): boolean {
  if (paused) return false;
  if (state === "OPEN") return true;
  return state === "LAST_CALL" && phaseEndsAt !== null && now < phaseEndsAt;
}
