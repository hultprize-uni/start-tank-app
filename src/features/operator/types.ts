/**
 * Contrato del view model de la consola del operador.
 * Los componentes presentacionales reciben únicamente estos tipos; el origen de los datos
 * (muestra o API real) queda encapsulado en el hook de estado.
 */

/** Estados que una ronda recorre en orden. El estado CANCELLED puede alcanzarse desde varios puntos. */
export const ROUND_STATUS_SEQUENCE = [
  "SCHEDULED",
  "OPEN",
  "LAST_CALL",
  "CLOSED",
  "VOTING",
  "SETTLED",
] as const;

export type RoundStatus = (typeof ROUND_STATUS_SEQUENCE)[number] | "CANCELLED";

/** Sentido de un voto del jurado. La abstención se excluye del cálculo del multiplicador. */
export type JurorSense = "backs" | "rejects" | "abstains";

export interface JurorVoteView {
  id: string;
  label: string;
  emitted: boolean;
  /** Sentido del voto. Es null mientras la ronda no se haya revelado o liquidado. */
  sense: JurorSense | null;
}

export type OperatorActionId = "open" | "last_call" | "close" | "reveal" | "next";

export interface OperatorActionView {
  id: OperatorActionId;
  label: string;
  done: boolean;
  enabled: boolean;
  /** Motivo visible cuando la acción está bloqueada. Es null cuando no aplica. */
  blockedReason: string | null;
}

/** Modo de anulación: devolver lo invertido al saldo, o liquidar a 1.0x. */
export type CancelMode = "refund" | "settle_1x";

/** Modo manual: el operador fija cuántos jurados respaldan la startup y desbloquea el veredicto. */
export interface ManualModeView {
  enabled: boolean;
  /** Jurados que respaldan, entre 0 y el tamaño del jurado. */
  backs: number;
}

export interface RoundView {
  number: number;
  total: number;
  startupName: string;
  status: RoundStatus;
  multiplier: number | null;
  cancelMode: CancelMode | null;
}

/** Fila de la lista de rondas del evento, usada en la barra lateral. */
export interface RoundSummaryView {
  number: number;
  startupName: string;
  status: RoundStatus;
  /** Multiplicador liquidado. Es null mientras la ronda no esté liquidada. */
  multiplier: number | null;
}

export interface MarketView {
  /** Monto acumulado de la ronda en Impact Coins. */
  accumulated: number;
  uniqueInvestors: number;
  connectedAttendees: number;
  /** Precio en vivo de la startup. */
  price: number;
  /** Segundos restantes de la última llamada. Es null fuera de esa fase. */
  lastCallRemaining: number | null;
}

/** Puntaje de una startup liquidada. Se ordena de mayor a menor puntaje. */
export interface StandingView {
  roundNumber: number;
  startupName: string;
  /** Puntaje entre 0 y 1: peso del jurado por la fracción de respaldo más peso de la tracción. */
  score: number;
  /** Fracción de respaldo del jurado, entre 0 y 1. */
  fraction: number | null;
}

export interface LogEntryView {
  id: string;
  /** Hora en formato HH:MM:SS. */
  time: string;
  /** Número de la ronda a la que pertenece la acción. */
  roundNumber: number;
  label: string;
  operator: string;
}

export interface BalanceRow {
  attendeeId: string;
  attendeeName: string;
  balance: number;
}

export interface PositionRow {
  attendeeId: string;
  attendeeName: string;
  round: number;
  startupName: string;
  amount: number;
  /** Retorno liquidado. Es null mientras la posición no esté liquidada. */
  returnAmount: number | null;
}

export interface OperatorViewModel {
  round: RoundView;
  /** Todas las rondas del evento, en orden. */
  rounds: RoundSummaryView[];
  actions: OperatorActionView[];
  jurors: JurorVoteView[];
  market: MarketView;
  /** Puntajes de las startups liquidadas, de mayor a menor. */
  standings: StandingView[];
  log: LogEntryView[];
  canUndo: boolean;
  canCancel: boolean;
  canManualSettle: boolean;
  manualMode: ManualModeView;
  balances: BalanceRow[];
  positions: PositionRow[];
}
