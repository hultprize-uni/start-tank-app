import type { Decision } from "@/lib/domain/types";

/** Pantallas del portal del jurado, en el orden en que se recorren. */
export type JuryScreen = "acceso" | "espera" | "votacion" | "voto_registrado";

/** Estado del formulario de acceso con código. */
export interface JuryAccessView {
  status: "inactivo" | "validando" | "error";
  errorMessage: string | null;
}

/** Ronda que el jurado evalúa o espera evaluar. */
export interface JuryRoundView {
  number: number;
  startupName: string;
}

/** Criterio de evaluación que se muestra como recordatorio. */
export interface JuryCriterion {
  id: "viabilidad" | "impacto_ods";
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
}

/** Conteo de votos de la ronda actual. */
export interface JuryVotesView {
  emitted: number;
  total: number;
}

/** Modelo de vista completo del portal del jurado. */
export interface JuryViewModel {
  screen: JuryScreen;
  access: JuryAccessView;
  jurorLabel: string | null;
  round: JuryRoundView | null;
  criteria: readonly JuryCriterion[];
  vote: JuryVoteView;
  votes: JuryVotesView;
}

/** Acciones que el portal dispara sobre el estado. */
export interface JuryActions {
  submitCode: (code: string) => void;
  selectDecision: (decision: Decision) => void;
  requestConfirm: () => void;
  cancelConfirm: () => void;
  confirmVote: () => void;
}
