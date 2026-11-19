import { classifyRounds, type RoundRow, type RoundVoteRow } from "@/server/db/rounds";
import type { JuryCriterion, JuryScreen, JuryViewModel } from "../types";

/*
 * Constructor puro del view model del portal del jurado. Recibe las filas que devuelven las
 * consultas de queries.ts y no accede a la base de datos.
 */

export interface JuryData {
  jurorId: string;
  name: string;
  rounds: readonly RoundRow[];
  /** Votos de la ronda activa. Vacío cuando no hay ronda activa. */
  votes: readonly RoundVoteRow[];
  totalJurors: number;
}

/** Criterios de evaluación que el portal del jurado recuerda en cada ronda. */
export const JURY_CRITERIA: readonly JuryCriterion[] = [
  { id: "viability", label: "Viabilidad" },
  { id: "sdg_impact", label: "Impacto ODS" },
];

/**
 * Construye el view model del portal del jurado. La pantalla "votacion" se muestra solo cuando la
 * ronda está en EN_VOTACION y el jurado aún no ha votado en ella.
 */
export function buildJuryView(data: JuryData): JuryViewModel {
  const active = classifyRounds(data.rounds).active;
  const cast = data.votes.filter((v) => v.decision !== null).length;
  const own = data.votes.find((v) => v.id_jurado === data.jurorId);
  const voteRegistered = own !== undefined && own.decision !== null;

  let screen: JuryScreen = "waiting";
  if (active?.estado === "VOTING") {
    screen = voteRegistered ? "vote_registered" : "voting";
  }

  return {
    screen: screen,
    access: { status: "idle", errorMessage: null },
    jurorLabel: data.name,
    round: active ? { number: active.numero, startupName: active.startup_nombre } : null,
    criteria: JURY_CRITERIA,
    vote: { draft: null, confirming: false, submitting: false, errorMessage: null },
    votes: { emitted: cast, total: data.totalJurors },
  };
}
