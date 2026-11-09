import type { Decision } from "@/lib/domain/types";

/** Fases de la pantalla del inversionista, en orden de la ronda. */
export type InvestorPhase =
  | "login"
  | "scheduled"
  | "open"
  | "lastCall"
  | "voting"
  | "result"
  | "final";

/** Ronda en curso dentro del evento. */
export interface RoundInfo {
  /** Número de la ronda en curso, desde 1. */
  number: number;
  /** Total de rondas del evento. */
  total: number;
}

/** Startup que se presenta en la ronda. */
export interface StartupInfo {
  name: string;
  /** Etiqueta del Objetivo de Desarrollo Sostenible, por ejemplo "ODS 7 · Energía asequible". */
  ods: string;
  description: string;
}

/** Saldo del inversionista y tope de inversión de la ronda. */
export interface WalletInfo {
  /** Saldo disponible en Impact Coins. */
  balance: number;
  /** Monto invertido por el inversionista en la ronda actual. */
  investedInRound: number;
  /** Tope de inversión de la ronda: 30 % del saldo al abrir la ronda. */
  roundCap: number;
}

/** Estado en vivo del mercado de la startup. */
export interface MarketInfo {
  /** Precio actual, entre 50 y 200. */
  price: number;
  /** Diferencia del precio frente al precio base de 100. */
  priceChange: number;
  /** Monto acumulado de la sala en la ronda. */
  totalRaised: number;
  /** Número de inversionistas que participaron en la ronda. */
  investorCount: number;
}

/** Resultado de la votación del jurado. */
export interface VerdictInfo {
  /** Voto de cada jurado. */
  decisions: Decision[];
  /** Jurados que respaldan. */
  backs: number;
  /** Votos emitidos; las abstenciones quedan excluidas. */
  voters: number;
  multiplier: number;
  invested: number;
  /** Retorno de la inversión: monto por multiplicador. */
  payout: number;
  /** Ganancia neta de la ronda: retorno menos monto invertido. */
  gain: number;
}

/** Fila del leaderboard del evento. */
export interface StandingEntry {
  position: number;
  name: string;
  balance: number;
  isCurrent: boolean;
}

/** Posición del inversionista y clasificación parcial. */
export interface StandingInfo {
  position: number;
  previousPosition: number;
  participants: number;
  /** Inversiones acertadas: startup con 3 o 4 respaldos. */
  hits: number;
  /** Número de rondas evaluadas hasta el momento. */
  hitsTotal: number;
  topThree: StandingEntry[];
  me: StandingEntry;
}

/**
 * Modelo de vista de la pantalla del inversionista. Lo entrega la API real y el
 * hook de simulación, con la misma forma. Los campos son nulos cuando la fase
 * no los requiere.
 */
export interface InvestorViewModel {
  phase: InvestorPhase;
  round: RoundInfo | null;
  startup: StartupInfo | null;
  wallet: WalletInfo | null;
  market: MarketInfo | null;
  /** Segundos restantes de la última llamada. Solo tiene valor en la fase lastCall. */
  countdownSeconds: number | null;
  verdict: VerdictInfo | null;
  standing: StandingInfo | null;
}
