export type RoundState =
  | "SCHEDULED"
  | "OPEN"
  | "LAST_CALL"
  | "CLOSED"
  | "VOTING"
  | "SETTLED"
  | "CANCELLED";

export type Decision = "BACK" | "REJECT" | "ABSTAIN";

export type OperatorAction =
  | "OPEN"
  | "LAST_CALL"
  | "CLOSE"
  | "ENABLE_VOTING"
  | "REVEAL"
  | "NEXT"
  | "CANCEL_REFUND"
  | "CANCEL_SETTLE_1X"
  | "UNDO"
  | "MANUAL_MODE";

export interface VerdictResult {
  backs: number;
  voters: number;
  fraction: number;
  multiplier: number;
}
