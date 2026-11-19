import type { Decision } from "@/shared/domain/types";

/**
 * Fases de la pantalla del evento. Cada una corresponde a una fila del cuadro de la especificacion
 * (seccion 2.6), más la espera previa a la primera ronda.
 */
export type ScreenPhase =
  | "WAITING"
  | "MARKET"
  | "LAST_CALL"
  | "VOTING"
  | "SETTLEMENT"
  | "BETWEEN_ROUNDS"
  | "CLOSING";

export interface SdgRef {
  number: number;
  name: string;
}

/** Startup en turno o recien liquidada. */
export interface StartupRef {
  name: string;
  sdg: SdgRef;
}

/** Datos de la ronda que la pantalla proyecta. */
export interface RoundRef {
  number: number;
  startup: StartupRef;
}

/** Voto revelado de un jurado. Se muestra solo en la fase de liquidacion. */
export interface RevealedVote {
  juror: string;
  decision: Decision;
}

/** Fila del leaderboard de inversionistas. */
export interface ScreenInvestorRow {
  position: number;
  name: string;
  balance: number;
}

/** Fila del acumulado por startup. */
export interface ScreenStartupRow {
  position: number;
  name: string;
  accumulated: number;
  price: number;
}

interface ScreenBase {
  phase: ScreenPhase;
  /** Marca de tiempo ISO de la ultima lectura. */
  updatedAt: string;
}

interface CurrentRound extends ScreenBase {
  round: RoundRef;
}

/** Espera previa al evento: ninguna ronda ha iniciado. Presenta la primera startup del programa. */
export interface Waiting extends ScreenBase {
  phase: "WAITING";
  nextRound: RoundRef;
}

export interface OpenMarket extends CurrentRound {
  phase: "MARKET";
  price: number;
  accumulated: number;
  uniqueInvestors: number;
}

export interface LastCall extends CurrentRound {
  phase: "LAST_CALL";
  price: number;
  accumulated: number;
  uniqueInvestors: number;
  /** Segundos restantes de la cuenta regresiva al momento de la lectura. */
  secondsRemaining: number;
}

export interface Voting extends CurrentRound {
  phase: "VOTING";
  votesCast: number;
  jurorsTotal: number;
}

export interface Settlement extends CurrentRound {
  phase: "SETTLEMENT";
  votes: RevealedVote[];
  backingFraction: number;
  multiplier: number;
  amountInvested: number;
  roundReturn: number;
}

export interface BetweenRounds extends ScreenBase {
  phase: "BETWEEN_ROUNDS";
  closedRound: RoundRef;
  investors: ScreenInvestorRow[];
  startups: ScreenStartupRow[];
}

export interface WinningStartup {
  name: string;
  sdg: SdgRef;
  score: number;
  backingFraction: number;
  investorPercentage: number;
}

export interface BestEyeInfo {
  name: string;
  hits: number;
}

export interface Closing extends ScreenBase {
  phase: "CLOSING";
  winner: WinningStartup;
  top3: ScreenInvestorRow[];
  bestEye: BestEyeInfo;
}

/** Modelo completo que consume la pantalla. Discriminado por `fase`. */
export type ScreenViewModel =
  | Waiting
  | OpenMarket
  | LastCall
  | Voting
  | Settlement
  | BetweenRounds
  | Closing;
