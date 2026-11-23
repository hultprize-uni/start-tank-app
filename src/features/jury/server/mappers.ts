import type { Criterion, PhaseClock, RoundState } from "@/shared/domain/types";
import { classifyRounds, sortRounds, type RoundRow, type RoundVoteRow } from "@/server/db/rounds";
import type { ScoreValue } from "../criteria";
import type {
  CriteriaScores,
  JuryPhase,
  JuryRailItem,
  JuryRevealJuror,
  JuryRevealView,
  JuryViewModel,
  OwnVerdictView,
} from "../types";
import { screenOf } from "../view-rules";

/*
 * Constructor puro del view model del portal del jurado. Recibe las filas que devuelven las
 * consultas de queries.ts y no accede a la base de datos.
 */

/** Veredicto propio de una ronda, usado para el recorrido y confirmación del envío. */
export interface OwnVerdictRow {
  id_ronda: string;
  se_abstiene: boolean;
  puntaje: string | null;
}

/** Nota de un criterio en borrador o enviada por el jurado. */
export interface DraftNoteRow {
  id_criterio: string;
  valor: number;
}

/** Nota de un jurado publicada únicamente tras liquidar la ronda. */
export interface RevealedNoteRow {
  id_jurado: string;
  id_criterio: string;
  valor: number;
}

export interface JuryData {
  jurorId: string;
  name: string;
  rounds: readonly RoundRow[];
  criteria: readonly Criterion[];
  /** Envíos de la ronda vigente, en orden de jurado. Vacío cuando no hay ronda vigente. */
  votes: readonly RoundVoteRow[];
  /** Veredictos propios en todas las rondas con envío registrado. */
  ownVerdicts: readonly OwnVerdictRow[];
  /** Borrador guardado del jurado en la ronda vigente. */
  draftNotes: readonly DraftNoteRow[];
  /** Notas propias ya enviadas en la ronda vigente. */
  ownRoundNotes: readonly DraftNoteRow[];
  /** Notas de los 4 jurados; solo se poblan cuando la ronda vigente está liquidada. */
  revealedNotes: readonly RevealedNoteRow[];
  /** Descripción de la startup de la ronda vigente. Nula cuando no hay ronda vigente. */
  description: string | null;
  /** Logotipo de la startup de la ronda vigente. Nulo si no está registrado. */
  logoUrl?: string | null;
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

function toScoreValue(value: number): ScoreValue | null {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }
  return null;
}

function mapCriterionNotes(rows: readonly DraftNoteRow[]): CriteriaScores {
  const result: CriteriaScores = {};
  for (const row of rows) {
    const score = toScoreValue(row.valor);
    if (score !== null) {
      result[row.id_criterio] = score;
    }
  }
  return result;
}

/** Recorrido de rondas: las terminadas muestran el resumen propio; la vigente, su posición. */
function buildRail(data: JuryData, current: RoundRow | undefined): JuryRailItem[] {
  const ownByRound = new Map(data.ownVerdicts.map((verdict) => [verdict.id_ronda, verdict]));

  return sortRounds(data.rounds).map((row) => {
    const finished = row.estado === "SETTLED" || row.estado === "CANCELLED";
    let status: JuryRailItem["status"] = "pending";
    if (finished) status = "settled";
    else if (row.id_ronda === current?.id_ronda) status = "current";

    const own = finished ? ownByRound.get(row.id_ronda) : undefined;
    return {
      number: row.numero,
      startupName: row.startup_nombre,
      status,
      ownVerdict:
        own === undefined
          ? null
          : {
              abstained: own.se_abstiene,
              score: own.puntaje === null ? null : Number(own.puntaje),
            },
    };
  });
}

/** Veredicto con puntaje, multiplicador y notas de los 4 jurados (solo con ronda liquidada). */
function buildReveal(
  data: JuryData,
  current: RoundRow,
  total: number,
): JuryRevealView {
  const notesByJuror = new Map<string, CriteriaScores>();
  for (const row of data.revealedNotes) {
    const score = toScoreValue(row.valor);
    if (score === null) continue;
    const currentNotes = notesByJuror.get(row.id_jurado) ?? {};
    currentNotes[row.id_criterio] = score;
    notesByJuror.set(row.id_jurado, currentNotes);
  }

  const jurors: JuryRevealJuror[] = data.votes.map((vote, index) => ({
    label: `Jurado ${index + 1}`,
    isOwn: vote.id_jurado === data.jurorId,
    submitted: vote.enviado,
    abstained: vote.se_abstiene,
    score: vote.se_abstiene || vote.puntaje === null ? null : Number(vote.puntaje),
    notes: vote.se_abstiene ? {} : (notesByJuror.get(vote.id_jurado) ?? {}),
  }));

  return {
    startupScore:
      current.puntaje_jurado === null || current.puntaje_jurado === undefined
        ? null
        : Number(current.puntaje_jurado),
    multiplier: current.multiplicador === null ? null : Number(current.multiplicador),
    jurors,
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

function buildOwnVerdict(
  current: RoundRow | undefined,
  ownVerdicts: readonly OwnVerdictRow[],
  ownRoundNotes: readonly DraftNoteRow[],
): OwnVerdictView | null {
  if (current === undefined) return null;
  const own = ownVerdicts.find((row) => row.id_ronda === current.id_ronda);
  if (own === undefined) return null;
  return {
    abstained: own.se_abstiene,
    score: own.se_abstiene || own.puntaje === null ? null : Number(own.puntaje),
    notes: own.se_abstiene ? {} : mapCriterionNotes(ownRoundNotes),
  };
}

/**
 * Construye el view model del portal del jurado. Las notas y puntajes de otros jurados solo se
 * publican en la fase "result"; antes de ella el view model expone únicamente conteos (RF-17, RNF-11).
 */
export function buildJuryView(data: JuryData): JuryViewModel {
  const current = resolveCurrentRound(data.rounds);
  const total = data.rounds.length;
  const ownVerdict = buildOwnVerdict(current.row, data.ownVerdicts, data.ownRoundNotes);
  const cast = data.votes.filter((vote) => vote.enviado).length;

  return {
    screen: screenOf(current.phase, ownVerdict !== null),
    phase: current.phase,
    clock: buildPhaseClock(current.row, data.now ?? new Date()),
    access: { status: "idle", errorMessage: null },
    jurorLabel: data.name,
    round:
      current.row === undefined
        ? null
        : {
            id: current.row.id_ronda,
            number: current.row.numero,
            total,
            startupName: current.row.startup_nombre,
            sdg: current.row.ods,
            description: data.description,
            logoUrl: data.logoUrl ?? null,
          },
    rail: buildRail(data, current.row),
    criteria: data.criteria,
    draftNotes: ownVerdict === null ? mapCriterionNotes(data.draftNotes) : {},
    draftStatus: "idle",
    draftError: null,
    vote: { sheet: null, submitting: false, errorMessage: null },
    votes: { emitted: cast, total: data.totalJurors },
    ownVerdict,
    reveal:
      current.phase === "result" && current.row !== undefined
        ? buildReveal(data, current.row, total)
        : null,
  };
}
