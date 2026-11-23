import type { Decision, PhaseClock, RoundState } from "@/shared/domain/types";
import { classifyRounds, sortRounds, type RoundRow, type RoundVoteRow } from "@/server/db/rounds";
import { JURY_CRITERIA } from "../criteria";
import type { JuryPhase, JuryRailItem, JuryRevealView, JuryViewModel } from "../types";
import { screenOf } from "../view-rules";

/*
 * Constructor puro del view model del portal del jurado. Recibe las filas que devuelven las
 * consultas de queries.ts y no accede a la base de datos.
 */

/** Voto propio de una ronda, usado para el recorrido del evento. */
export interface OwnVoteRow {
  id_ronda: string;
  decision: Decision;
}

export interface JuryData {
  jurorId: string;
  name: string;
  rounds: readonly RoundRow[];
  /** Votos de la ronda vigente, en orden de jurado. Vacío cuando no hay ronda vigente. */
  votes: readonly RoundVoteRow[];
  /** Votos propios en todas las rondas con decisión registrada. */
  ownVotes: readonly OwnVoteRow[];
  /** Descripción de la startup de la ronda vigente. Nula cuando no hay ronda vigente. */
  description: string | null;
  totalJurors: number;
  /** Hora del servidor usada para sincronizar el reloj de la fase. */
  now?: Date;
}

/** Fase del jurado asociada a cada estado de la ronda. */
const PHASE_BY_STATE: Readonly<Record<RoundState, JuryPhase>> = {
  SCHEDULED: "scheduled",
  OPEN: "open",
  LAST_CALL: "last_call",
  CLOSED: "closed",
  VOTING: "voting",
  SETTLED: "result",
  CANCELLED: "cancelled",
};

/** Ronda vigente del portal y la fase que se muestra al jurado. */
export interface CurrentRound {
  /** Ronda vigente. Indefinida cuando el evento no tiene rondas pendientes ni en curso. */
  row: RoundRow | undefined;
  phase: JuryPhase;
}

/**
 * Determina la ronda vigente. Una ronda en curso tiene prioridad; después, la última ronda
 * terminada permanece visible hasta que se abre la siguiente; por último, la primera pendiente.
 */
export function resolveCurrentRound(rounds: readonly RoundRow[]): CurrentRound {
  const { active, pending, lastFinished } = classifyRounds(rounds);
  if (active) return { row: active, phase: PHASE_BY_STATE[active.estado] };
  if (lastFinished) return { row: lastFinished, phase: PHASE_BY_STATE[lastFinished.estado] };
  if (pending) return { row: pending, phase: "scheduled" };
  return { row: undefined, phase: "final" };
}

/** Recorrido de rondas: las terminadas muestran el voto propio; la vigente, su posición. */
function buildRail(
  data: JuryData,
  current: RoundRow | undefined,
): JuryRailItem[] {
  const ownByRound = new Map(data.ownVotes.map((vote) => [vote.id_ronda, vote.decision]));

  return sortRounds(data.rounds).map((row) => {
    const finished = row.estado === "SETTLED" || row.estado === "CANCELLED";
    let status: JuryRailItem["status"] = "pending";
    if (finished) status = "settled";
    else if (row.id_ronda === current?.id_ronda) status = "current";

    return {
      number: row.numero,
      startupName: row.startup_nombre,
      status,
      ownDecision: finished ? (ownByRound.get(row.id_ronda) ?? null) : null,
    };
  });
}

/** Veredicto con los votos de los jurados, publicados solo cuando la ronda está liquidada. */
function buildReveal(
  data: JuryData,
  current: RoundRow,
  total: number,
): JuryRevealView {
  return {
    multiplier: current.multiplicador === null ? null : Number(current.multiplicador),
    votes: data.votes.map((vote, index) => ({
      label: `Jurado ${index + 1}`,
      isOwn: vote.id_jurado === data.jurorId,
      decision: vote.decision,
    })),
    isLastRound: current.numero === total,
  };
}

/** Reloj de fase construido desde la fila de ronda vigente (RF-07, RNF-15). */
function buildPhaseClock(current: RoundRow | undefined, now: Date): PhaseClock | null {
  if (current === undefined) return null;
  const phaseEndsAt = current.fase_termina_en ?? null;
  const pausedSeconds = current.segundos_restantes_pausa ?? null;
  if (phaseEndsAt === null && pausedSeconds === null) return null;
  return {
    serverTime: now.toISOString(),
    phaseEndsAt,
    paused: pausedSeconds !== null,
    pausedSeconds,
  };
}

/**
 * Construye el view model del portal del jurado. Los votos de otros jurados solo se publican en la
 * fase "result"; antes de ella el view model expone únicamente conteos.
 */
export function buildJuryView(data: JuryData): JuryViewModel {
  const current = resolveCurrentRound(data.rounds);
  const total = data.rounds.length;
  const ownVote = data.votes.find((vote) => vote.id_jurado === data.jurorId)?.decision ?? null;
  const cast = data.votes.filter((vote) => vote.decision !== null).length;

  return {
    screen: screenOf(current.phase, ownVote),
    phase: current.phase,
    clock: buildPhaseClock(current.row, data.now ?? new Date()),
    access: { status: "idle", errorMessage: null },
    jurorLabel: data.name,
    round:
      current.row === undefined
        ? null
        : {
            number: current.row.numero,
            total,
            startupName: current.row.startup_nombre,
            sdg: current.row.ods,
            description: data.description,
          },
    rail: buildRail(data, current.row),
    criteria: JURY_CRITERIA,
    vote: { draft: null, confirming: false, submitting: false, errorMessage: null },
    votes: { emitted: cast, total: data.totalJurors },
    ownVote,
    reveal:
      current.phase === "result" && current.row !== undefined
        ? buildReveal(data, current.row, total)
        : null,
  };
}
