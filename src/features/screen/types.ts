import type { PhaseClock } from "@/shared/domain/types";

/*
 * Modelo de la pantalla del escenario (WORKPLAN F6). Una sola forma para todas las fases: los
 * componentes conservan su estado entre fases y las animaciones tienen continuidad.
 */

export type StagePhase =
  | "WAITING"
  | "MARKET"
  | "LAST_CALL"
  | "VOTING"
  | "REVEAL"
  | "BETWEEN"
  | "CLOSING";

export interface StageStartup {
  name: string;
  /** Por ejemplo "ODS 6: Agua limpia y saneamiento". */
  sdg: string;
  description: string;
  logoUrl: string | null;
  /** Dos letras para la marca cuando no hay logo, por ejemplo "AC". */
  initials: string;
}

/** Estado de una startup en la cinta superior. */
export type TickerStatus = "done" | "live" | "voting" | "next" | "pending" | "cancelled";

export interface TickerItem {
  number: number;
  name: string;
  status: TickerStatus;
  /** Multiplicador final, cuando la ronda se liquidó. */
  multiplier: number | null;
}

export interface InvestorRow {
  id: string;
  position: number;
  /** Nombre y la inicial del apellido, por ejemplo "Mariana T.". */
  name: string;
  balance: number;
  /** Posición en el corte anterior. Nula si no había corte. */
  previousPosition: number | null;
}

export interface JurySeat {
  label: string;
  sent: boolean;
  abstained: boolean;
  /** Puntaje del jurado. Solo viaja después de revelar (RF-17): antes es nulo. */
  score: number | null;
}

export type FeedTone = "bet" | "milestone" | "phase" | "jury" | "verdict";

export interface FeedItem {
  id: string;
  text: string;
  at: string;
  tone: FeedTone;
}

export interface MarketPoint {
  at: string;
  /** Monto acumulado de la sala tras esa inversión. */
  total: number;
}

export interface StageMarket {
  accumulated: number;
  price: number;
  investors: number;
  attendees: number;
  /** Un punto por inversión, en orden: la curva escalonada. */
  points: MarketPoint[];
}

export interface StageVerdict {
  multiplier: number;
  /** Nulo en una ronda anulada. */
  juryScore: number | null;
  scorePct: number | null;
  invested: number;
  returned: number;
  cancelled: boolean;
  settledAt: string | null;
}

export interface StartupResult {
  name: string;
  juryScore: number | null;
  multiplier: number | null;
  cancelled: boolean;
}

export interface ClosingInfo {
  winner: StageStartup & {
    multiplier: number | null;
    juryScore: number | null;
    investorShare: number;
    finalScore: number;
  };
  top3: InvestorRow[];
  bestEye: { name: string; hits: number; rounds: number } | null;
}

export interface ScreenViewModel {
  phase: StagePhase;
  serverTime: string;
  manualMode: boolean;
  round: { number: number; total: number } | null;
  /** Startup en escena, la que se acaba de revelar o, en la espera, la siguiente. */
  startup: StageStartup | null;
  clock: PhaseClock | null;
  /** Nombre de la etapa del cronómetro: Pitch, Toma y dame, Última llamada o Votación. */
  clockLabel: string | null;
  market: StageMarket | null;
  jury: JurySeat[];
  verdict: StageVerdict | null;
  investors: InvestorRow[];
  ticker: TickerItem[];
  feed: FeedItem[];
  /** Rondas terminadas, para la pantalla entre rondas. */
  results: StartupResult[];
  /** Startup que sube después, entre rondas. */
  next: StageStartup | null;
  closing: ClosingInfo | null;
}
