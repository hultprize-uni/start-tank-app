import type { Decision } from "@/shared/domain/types";

/** Pantalla visible del portal del jurado. */
export type JuryScreen = "access" | "waiting" | "voting" | "vote_registered" | "result";

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
  number: number;
  /** Cantidad de rondas del evento. */
  total: number;
  startupName: string;
  /** Objetivo de Desarrollo Sostenible, por ejemplo "ODS 6". Nulo si no está registrado. */
  sdg: string | null;
  /** Descripción breve de la startup. Nula si no está registrada. */
  description: string | null;
}

/** Criterio de evaluación que se muestra como recordatorio. */
export interface JuryCriterion {
  id: "viability" | "sdg_impact";
  label: string;
}

/** Estado del voto dentro de la ronda en votación. */
export interface JuryVoteView {
  /** Decisión elegida, aún no confirmada. */
  draft: Decision | null;
  /** Indica si se muestra el paso de confirmación del voto definitivo. */
  confirming: boolean;
  /** Indica si el voto se está enviando. */
  submitting: boolean;
  /** Mensaje del último intento de voto fallido. Es null cuando no hay error. */
  errorMessage: string | null;
}

/** Conteo de votos de la ronda actual. */
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
  /** Decisión propia de una ronda terminada. Nula cuando no hay voto o la ronda no ha terminado. */
  ownDecision: Decision | null;
}

/** Voto de un jurado publicado al liquidar la ronda. */
export interface JuryRevealVote {
  label: string;
  /** Indica si el voto corresponde al jurado de la sesión. */
  isOwn: boolean;
  decision: Decision | null;
}

/** Veredicto de la ronda liquidada: multiplicador y votos publicados a la vez. */
export interface JuryRevealView {
  multiplier: number | null;
  votes: readonly JuryRevealVote[];
  /** Indica si la ronda es la última del evento. */
  isLastRound: boolean;
}

/** Modelo de vista completo del portal del jurado. */
export interface JuryViewModel {
  screen: JuryScreen;
  /** Fase de la ronda vigente. Nula mientras el jurado no ha ingresado. */
  phase: JuryPhase | null;
  access: JuryAccessView;
  jurorLabel: string | null;
  round: JuryRoundView | null;
  /** Recorrido de todas las rondas del evento, en orden. */
  rail: readonly JuryRailItem[];
  criteria: readonly JuryCriterion[];
  vote: JuryVoteView;
  votes: JuryVotesView;
  /** Decisión registrada por el jurado en la ronda vigente. Nula si aún no vota. */
  ownVote: Decision | null;
  /** Veredicto publicado. Solo existe cuando la fase es "result". */
  reveal: JuryRevealView | null;
}

/** Acciones que el portal dispara sobre el estado. */
export interface JuryActions {
  submitCode: (code: string) => void;
  selectDecision: (decision: Decision) => void;
  requestConfirm: () => void;
  cancelConfirm: () => void;
  confirmVote: () => void;
}
