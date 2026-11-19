/**
 * Contrato del view model de la consola del operador.
 * Los componentes presentacionales reciben únicamente estos tipos; el origen de los datos
 * (mock o API real) queda encapsulado en el hook de estado.
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

export type OperatorActionId =
  | "open"
  | "last_call"
  | "close"
  | "reveal"
  | "next";

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

export type ManualResult = "approved" | "not_approved";

export interface ManualSettlementInput {
  multiplier: number;
  result: ManualResult;
}

export interface RoundView {
  number: number;
  total: number;
  startupName: string;
  status: RoundStatus;
  multiplier: number | null;
  result: ManualResult | null;
  cancelMode: CancelMode | null;
}

export interface MarketView {
  /** Monto acumulado de la ronda en Impact Coins. */
  accumulated: number;
  uniqueInvestors: number;
  connectedAttendees: number;
  /** Precio en vivo de la startup. */
  price: number;
}

export interface LogEntryView {
  id: string;
  /** Hora en formato HH:MM. */
  time: string;
  label: string;
  operator: string;
  detail: string | null;
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
  screenSynced: boolean;
  actions: OperatorActionView[];
  jurors: JurorVoteView[];
  market: MarketView;
  log: LogEntryView[];
  canUndo: boolean;
  canCancel: boolean;
  canManualSettle: boolean;
  balances: BalanceRow[];
  positions: PositionRow[];
}
