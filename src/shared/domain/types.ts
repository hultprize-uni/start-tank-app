export type RoundState =
  | "SCHEDULED"
  | "OPEN"
  | "LAST_CALL"
  | "CLOSED"
  | "VOTING"
  | "SETTLED"
  | "CANCELLED";

/** @deprecated Reglas anteriores. El jurado ahora califica criterios de 1 a 5; se retira en F4 a F6. */
export type Decision = "BACK" | "REJECT" | "ABSTAIN";

export type OperatorAction =
  | "OPEN"
  | "LAST_CALL"
  | "CLOSE"
  | "ENABLE_VOTING"
  | "PAUSE"
  | "RESUME"
  | "ADD_MINUTE"
  | "REVEAL"
  | "NEXT"
  | "CANCEL_REFUND"
  | "CANCEL_SETTLE_1X"
  | "UNDO"
  | "MANUAL_MODE";

/** Rol del operador: el conductor ejecuta acciones; el soporte solo observa. */
export type OperatorRole = "CONDUCTOR" | "SUPPORT";

/** @deprecated Resultado con respaldos; ver calcScoreVerdict. */
export interface VerdictResult {
  backs: number;
  voters: number;
  fraction: number;
  multiplier: number;
}

/** Nota de un jurado en un criterio, con el peso del criterio. */
export interface CriterionNote {
  /** Nota de 1 a 5. */
  value: number;
  weight: number;
}

/** Criterio de calificación del jurado, con las frases de referencia de la nota 1 y la 5. */
export interface Criterion {
  id: string;
  name: string;
  weight: number;
  anchorMin: string;
  anchorMax: string;
}

/**
 * Reloj de la fase vigente, común a todas las vistas (RF-07, RNF-15). Las horas son ISO 8601 del
 * servidor; cada cliente calcula los segundos restantes con su desfase respecto del servidor.
 */
export interface PhaseClock {
  /** Hora del servidor en que se armó la respuesta. */
  serverTime: string;
  /** Hora en que termina la fase actual. Nula sin cronómetro o en pausa. */
  phaseEndsAt: string | null;
  /** Indica si el conductor pausó la ronda. */
  paused: boolean;
  /** Segundos que faltaban al pausar. Nulo fuera de pausa. */
  pausedSeconds: number | null;
}

/** Cuerpo base de toda respuesta de estado: incluye la hora del servidor. */
export interface StateEnvelope {
  serverTime: string;
}

/** Resultado del cierre del evento (proceso batch). */
export interface EventCloseSummary {
  closedAt: string;
  winnerStartup: { name: string; juryScore: number; investorShare: number; finalScore: number } | null;
  topInvestors: { name: string; balance: number; hits: number }[];
  bestEye: { name: string; hits: number } | null;
}
