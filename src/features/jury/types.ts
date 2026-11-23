import type { Criterion, PhaseClock } from "@/shared/domain/types";
import type { ScoreValue } from "./criteria";
import type { DraftStatus } from "./hooks/useDraft";

/** Pantalla visible del portal del jurado. */
export type JuryScreen = "access" | "waiting" | "grading" | "vote_registered" | "result";

/**
 * Fase de la ronda vigente vista desde el jurado. Cada fase corresponde a un estado de la ronda,
 * salvo "final", que indica que el evento no tiene ronda pendiente ni en curso.
 */
export type JuryPhase =
  | "scheduled"
  | "open"
  | "last_call"
  | "closed"
  | "voting"
  | "result"
  | "cancelled"
  | "final";

/** Estado del formulario de acceso con código. */
export interface JuryAccessView {
  status: "idle" | "validating" | "error";
  errorMessage: string | null;
}

/** Ronda que el jurado evalúa o espera evaluar. */
export interface JuryRoundView {
  id: string;
  number: number;
  /** Cantidad de rondas del evento. */
  total: number;
  startupName: string;
  /** Objetivo de Desarrollo Sostenible, por ejemplo "ODS 6". Nulo si no está registrado. */
  sdg: string | null;
  /** Descripción breve de la startup. Nula si no está registrada. */
  description: string | null;
  /** URL del logotipo de la startup. Nula si no está registrada. */
  logoUrl: string | null;
}

/** Mapa de notas en borrador o enviadas, indexado por identificador de criterio. */
export type CriteriaScores = Partial<Record<string, ScoreValue>>;

/** Nota individual enviada al endpoint definitivo de votación. */
export interface CriterionScoreItem {
  criterionId: string;
  value: ScoreValue;
}

/** Carga aceptada por el envío definitivo de notas o abstención. */
export type JuryVotePayload =
  | { abstain: true }
  | { abstain: false; notes: readonly CriterionScoreItem[] };

export type DraftSaveStatus = DraftStatus;

/** Estado de las hojas de confirmación y envío definitivo. */
export interface JuryVoteUiState {
  sheet: "confirm_send" | "abstain" | null;
  submitting: boolean;
  errorMessage: string | null;
}

/** Envío propio registrado por el jurado en la ronda vigente. */
export interface OwnVerdictView {
  abstained: boolean;
  score: number | null;
  notes: CriteriaScores;
}

/** Conteo de envíos de la ronda actual. */
export interface JuryVotesView {
  emitted: number;
  total: number;
}

/** Entrada del recorrido de rondas del evento. */
export interface JuryRailItem {
  number: number;
  startupName: string;
  /** settled: ronda liquidada o anulada; current: ronda en escena; pending: aún no inicia. */
  status: "settled" | "current" | "pending";
  /** Envío propio de una ronda terminada. Nulo si no envió o la ronda no termina. */
  ownVerdict: { abstained: boolean; score: number | null } | null;
}

/** Resultado de un jurado publicado al revelar el veredicto de la ronda. */
export interface JuryRevealJuror {
  label: string;
  /** Indica si corresponde al jurado de la sesión. */
  isOwn: boolean;
  submitted: boolean;
  abstained: boolean;
  score: number | null;
  notes: CriteriaScores;
}

/** Veredicto de la ronda liquidada: puntaje promedio, multiplicador y notas de los 4 jurados. */
export interface JuryRevealView {
  startupScore: number | null;
  multiplier: number | null;
  jurors: readonly JuryRevealJuror[];
  /** Indica si la ronda es la última del evento. */
  isLastRound: boolean;
}

/** Modelo de vista completo del portal del jurado. */
export interface JuryViewModel {
  screen: JuryScreen;
  /** Fase de la ronda vigente. Nula mientras el jurado no ha ingresado. */
  phase: JuryPhase | null;
  /** Reloj de la fase sincronizado con la hora del servidor. */
  clock: PhaseClock | null;
  access: JuryAccessView;
  jurorLabel: string | null;
  round: JuryRoundView | null;
  /** Recorrido de todas las rondas del evento, en orden. */
  rail: readonly JuryRailItem[];
  criteria: readonly Criterion[];
  draftNotes: CriteriaScores;
  draftStatus: DraftSaveStatus;
  draftError: string | null;
  vote: JuryVoteUiState;
  votes: JuryVotesView;
  /** Envío definitivo del jurado en la ronda vigente. Nulo si aún no envía. */
  ownVerdict: OwnVerdictView | null;
  /** Veredicto publicado. Solo existe cuando la fase es "result". */
  reveal: JuryRevealView | null;
}

/** Acciones que el portal dispara sobre el estado. */
export interface JuryActions {
  submitCode: (code: string) => void;
  setScore: (criterionId: string, value: ScoreValue) => void;
  openConfirmSend: () => void;
  openAbstain: () => void;
  closeSheet: () => void;
  confirmSend: () => void;
  confirmAbstain: () => void;
  logout: () => void;
}
