import type { OperatorAction, RoundState } from "./types";

/** Resultado de aplicar una acción a una ronda. */
export type ResultadoTransicion =
  | { ok: true; state: RoundState }
  | { ok: false; reason: "TRANSICION_INVALIDA" };

/**
 * Transiciones válidas de la ronda, indexadas por estado y acción del operador.
 * Un estado sin entradas es terminal. La expiración del temporizador de última
 * llamada se representa con la acción CERRAR, que el sistema invoca al vencer el plazo.
 */
export const ROUND_TRANSITIONS: Readonly<
  Record<RoundState, Readonly<Partial<Record<OperatorAction, RoundState>>>>
> = {
  PROGRAMADA: { ABRIR: "ABIERTA" },
  ABIERTA: { ULTIMA_LLAMADA: "ULTIMA_LLAMADA" },
  ULTIMA_LLAMADA: { CERRAR: "CERRADA" },
  CERRADA: {
    HABILITAR_VOTO: "EN_VOTACION",
    ANULAR_DEVOLVER: "ANULADA",
    ANULAR_LIQUIDAR_1X: "ANULADA",
  },
  EN_VOTACION: { REVELAR: "LIQUIDADA" },
  LIQUIDADA: {},
  ANULADA: {},
};

/**
 * Aplica una acción del operador al estado vigente de la ronda. Rechaza las
 * acciones que no corresponden al estado. Las acciones SIGUIENTE, DESHACER y
 * MODO_MANUAL no modifican el estado de la ronda y se rechazan en esta función.
 */
export function nextState(state: RoundState, action: OperatorAction): ResultadoTransicion {
  const target = ROUND_TRANSITIONS[state][action];

  if (target === undefined) {
    return { ok: false, reason: "TRANSICION_INVALIDA" };
  }

  return { ok: true, state: target };
}
