import type { PhaseClock } from "@/shared/domain/types";

/** Fases de la pantalla del inversionista, en orden de la ronda. */
export type ParticipantPhase =
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
  sdg: string;
  description: string;
  /** URL del logo. Nula si la startup no tiene logo cargado. */
  logoUrl: string | null;
}

/** Saldo del inversionista y su inversión en la ronda. */
export interface WalletInfo {
  /** Saldo disponible en Impact Coins. */
  balance: number;
  /** Monto invertido en la ronda actual; cero si aún no invierte. */
  investedInRound: number;
  /** Tope de la ronda: 30 % del saldo con que entra a la ronda. */
  roundCap: number;
  /** Una sola inversión por ronda (RF-12): verdadero si ya invirtió en la ronda actual. */
  alreadyInvested: boolean;
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

/** Modo de anulación elegido por el operador: devolver lo invertido o liquidar a 1.0x. */
export type AnnulmentMode = "refund" | "settle-1x";

/** Resultado de la ronda para el inversionista. */
export interface VerdictInfo {
  /** Puntaje promedio del jurado, de 1 a 5. Nulo en una ronda anulada. */
  juryScore: number | null;
  /** Puntaje expresado en porcentaje: 0 % con 1 y 100 % con 5. */
  scorePct: number | null;
  multiplier: number;
  invested: number;
  /** Retorno de la inversión: monto por multiplicador. */
  payout: number;
  /** Ganancia neta de la ronda: retorno menos monto invertido. */
  gain: number;
  /** Modo de anulación, o nulo si la ronda no fue anulada. */
  annulment: AnnulmentMode | null;
  /** Hora ISO de la liquidación. El teléfono revela 3 segundos después (RF-22). */
  settledAt: string | null;
}

/** Estado de una ronda en el riel lateral y en el historial del inversionista. */
export type RoundTrackState = "pending" | "current" | "settled" | "annulled";

/** Resumen de una ronda del evento para el riel lateral y el historial del inversionista. */
export interface RoundSummary {
  /** Número de la ronda, desde 1. */
  number: number;
  startupName: string;
  state: RoundTrackState;
  /** Monto invertido por el inversionista en la ronda. */
  invested: number;
  /** Ganancia neta de la ronda; nula mientras la ronda no está liquidada ni anulada. */
  gain: number | null;
}

/** Fila del leaderboard del evento. */
export interface StandingEntry {
  position: number;
  name: string;
  balance: number;
  isCurrent: boolean;
  /** Posición en la ronda anterior, para la flecha de movimiento. Nula si no existía. */
  previousPosition: number | null;
}

/** Posición del inversionista y clasificación parcial. */
export interface StandingInfo {
  position: number;
  previousPosition: number;
  participants: number;
  /** Inversiones acertadas: rondas con multiplicador mayor que 1.0. */
  hits: number;
  /** Número de rondas evaluadas hasta el momento. */
  hitsTotal: number;
  /** Aciertos seguidos en las últimas rondas en que invirtió: la racha de mejor ojo. */
  streak: number;
  topThree: StandingEntry[];
  /** El inversionista con hasta 2 vecinos por arriba y 2 por abajo. */
  window: StandingEntry[];
  /** Patrimonio que le falta para alcanzar al primero; cero si es el primero. */
  distanceToFirst: number;
  /** Patrimonio que le falta para entrar al podio; cero si ya está en él. */
  distanceToPodium: number;
  me: StandingEntry;
}

/**
 * Modelo de vista de la pantalla del inversionista. Lo entrega la API real y el hook de simulación,
 * con la misma forma. Los campos son nulos cuando la fase no los requiere.
 */
export interface ParticipantViewModel {
  phase: ParticipantPhase;
  round: RoundInfo | null;
  startup: StartupInfo | null;
  wallet: WalletInfo | null;
  market: MarketInfo | null;
  /** Reloj de la fase con la hora del servidor (RNF-15). Nulo fuera de una ronda activa. */
  clock: PhaseClock | null;
  verdict: VerdictInfo | null;
  /** Clasificación. Nula hasta que termina la primera ronda. */
  standing: StandingInfo | null;
  /** Todas las rondas del evento, en orden. */
  rounds: RoundSummary[];
  /** Startup ganadora, cuando el evento cerró. */
  winnerStartup: string | null;
  /** Hora del servidor en que se armó el estado. */
  serverTime?: string;
}

/** Resultado de confirmar una inversión. El mensaje explica el motivo del rechazo. */
export type InvestmentResult = { ok: true } | { ok: false; message: string };

/** Acciones del portal del inversionista. */
export interface ParticipantActions {
  /** Registra una inversión de monto entero en la ronda abierta. */
  invest: (amount: number) => Promise<InvestmentResult>;
}

/** Estado de la última carga del view model. */
export type ParticipantLoadStatus = "loading" | "ready" | "error";

/** Contrato del hook de estado del portal, común a la API real y a la simulación. */
export interface UseParticipantStateResult {
  /** View model vigente; nulo hasta la primera respuesta correcta. */
  vm: ParticipantViewModel | null;
  status: ParticipantLoadStatus;
  /** Mensaje del último fallo de carga, o nulo. */
  errorMessage: string | null;
  actions: ParticipantActions;
}
