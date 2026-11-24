import type { Criterion } from "@/shared/domain/types";
import { sql } from "@/server/db/client";
import { classifyRounds, closeExpiredLastCall, queryRoundVotes, queryRounds } from "@/server/db/rounds";
import type { StaffMember } from "@/server/db/staff";
import { normalizeFunctionResult, type FunctionResult } from "@/server/db/values";
import type { JuryVotePayload } from "../types";
import {
  buildJuryView,
  resolveCurrentRound,
  type DraftNoteRow,
  type OwnVerdictRow,
  type RevealedNoteRow,
} from "./mappers";
import type { JuryViewModel } from "../types";

/*
 * Consultas del portal del jurado. Las lecturas delegan el armado del view model en mappers.ts; el
 * borrador y el envío definitivo se realizan solo mediante fn_guardar_borrador y fn_registrar_voto.
 */

const GRADABLE_DB_STATES = new Set(["OPEN", "LAST_CALL", "CLOSED", "VOTING"]);

interface RawCriterionRow {
  id: string;
  name: string;
  weight: string;
  anchor_min: string;
  anchor_max: string;
}

/** Criterios de evaluación ordenados desde la tabla criterio (RF-14). */
export async function queryCriteria(): Promise<Criterion[]> {
  const rows = await sql<RawCriterionRow>`
    select id_criterio::text as id,
           nombre as name,
           peso::text as weight,
           ancla_min as anchor_min,
           ancla_max as anchor_max
      from criterio
     order by id_criterio`;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    weight: Number(row.weight),
    anchorMin: row.anchor_min,
    anchorMax: row.anchor_max,
  }));
}

/** Número de jurados registrados. */
async function queryJurorCount(): Promise<number> {
  const [row] = await sql<{ total: number }>`select count(*)::int as total from jurado`;
  return row?.total ?? 0;
}

/** Busca un jurado por su código de acceso. */
export async function findJurorByCode(code: string): Promise<StaffMember | null> {
  const [row] = await sql<StaffMember>`
    select id_jurado::text as id, nombre
      from jurado
     where codigo_acceso = ${code}
     limit 1`;
  return row ?? null;
}

/** Busca un jurado por su identificador de sesión. */
export async function findJurorById(id: string): Promise<StaffMember | null> {
  const [row] = await sql<StaffMember>`
    select id_jurado::text as id, nombre
      from jurado
     where id_jurado = ${id}::bigint`;
  return row ?? null;
}

/** Descripción y logotipo de la startup de una ronda. */
async function queryRoundStartupDetails(
  roundId: string,
): Promise<{ description: string | null; logoUrl: string | null }> {
  const [row] = await sql<{ descripcion: string | null; logo_url: string | null }>`
    select s.descripcion, s.logo_url
      from ronda r
      join startup s on s.id_startup = r.id_startup
     where r.id_ronda = ${roundId}::bigint`;
  return { description: row?.descripcion ?? null, logoUrl: row?.logo_url ?? null };
}

/** Borrador de notas guardado para el jurado en la ronda indicada. */
async function queryDraftNotes(jurorId: string, roundId: string): Promise<DraftNoteRow[]> {
  return sql<DraftNoteRow>`
    select id_criterio::text as id_criterio,
           valor
      from borrador_nota
     where id_jurado = ${jurorId}::bigint
       and id_ronda = ${roundId}::bigint`;
}

/** Veredictos propios registrados por el jurado en todas las rondas. */
async function queryOwnVerdicts(jurorId: string): Promise<OwnVerdictRow[]> {
  return sql<OwnVerdictRow>`
    select v.id_ronda::text as id_ronda,
           v.se_abstiene,
           v.puntaje::text as puntaje
      from veredicto v
     where v.id_jurado = ${jurorId}::bigint`;
}

/** Notas propias ya enviadas por el jurado en la ronda vigente. */
async function queryOwnRoundNotes(jurorId: string, roundId: string): Promise<DraftNoteRow[]> {
  return sql<DraftNoteRow>`
    select nc.id_criterio::text as id_criterio,
           nc.valor
      from nota_criterio nc
      join veredicto v on v.id_veredicto = nc.id_veredicto
     where v.id_jurado = ${jurorId}::bigint
       and v.id_ronda = ${roundId}::bigint`;
}

/**
 * Notas de los cuatro jurados en una ronda liquidada. Solo debe invocarse cuando la ronda está
 * en estado SETTLED para preservar el secreto del voto (RF-17, RNF-11).
 */
async function queryRevealedRoundNotes(roundId: string): Promise<RevealedNoteRow[]> {
  return sql<RevealedNoteRow>`
    select v.id_jurado::text as id_jurado,
           nc.id_criterio::text as id_criterio,
           nc.valor
      from nota_criterio nc
      join veredicto v on v.id_veredicto = nc.id_veredicto
     where v.id_ronda = ${roundId}::bigint`;
}

/**
 * Lee el view model del portal del jurado. Devuelve nulo cuando el jurado no existe.
 * Las notas de otros jurados no se consultan ni exponen antes de liquidar la ronda (RF-17, RNF-11).
 */
export async function readJuryView(jurorId: string): Promise<JuryViewModel | null> {
  const juror = await findJurorById(jurorId);
  if (juror === null) return null;

  const [rounds, criteria] = await Promise.all([queryRounds(), queryCriteria()]);
  const current = resolveCurrentRound(rounds).row;
  const isGradable = current !== undefined && GRADABLE_DB_STATES.has(current.estado);
  const isSettled = current?.estado === "SETTLED";

  const [votes, ownVerdicts, startupDetails, totalJurors, draftNotes, revealedNotes] =
    await Promise.all([
      current ? queryRoundVotes(current.id_ronda) : Promise.resolve([]),
      queryOwnVerdicts(juror.id),
      current
        ? queryRoundStartupDetails(current.id_ronda)
        : Promise.resolve({ description: null, logoUrl: null }),
      queryJurorCount(),
      isGradable && current ? queryDraftNotes(juror.id, current.id_ronda) : Promise.resolve([]),
      isSettled && current ? queryRevealedRoundNotes(current.id_ronda) : Promise.resolve([]),
    ]);

  const ownInCurrent = current
    ? ownVerdicts.find((row) => row.id_ronda === current.id_ronda)
    : undefined;

  let ownRoundNotes: DraftNoteRow[] = [];
  if (current !== undefined && ownInCurrent !== undefined && !ownInCurrent.se_abstiene) {
    ownRoundNotes = isSettled
      ? revealedNotes
          .filter((row) => row.id_jurado === juror.id)
          .map(({ id_criterio, valor }) => ({ id_criterio, valor }))
      : await queryOwnRoundNotes(juror.id, current.id_ronda);
  }

  return buildJuryView({
    jurorId: juror.id,
    name: juror.nombre,
    rounds,
    criteria,
    votes,
    ownVerdicts,
    draftNotes,
    ownRoundNotes,
    revealedNotes,
    description: startupDetails.description,
    logoUrl: startupDetails.logoUrl,
    totalJurors,
    now: new Date(),
  });
}

export interface VoteSubmissionResult extends FunctionResult {
  score?: number | null;
}

/**
 * Registra el envío definitivo del jurado (notas por criterio o abstención) en la ronda en
 * votación mediante fn_registrar_voto (RF-15, RF-16).
 */
export async function registerVote(
  jurorId: string,
  payload: JuryVotePayload,
): Promise<VoteSubmissionResult> {
  const rounds = await queryRounds();
  const active = classifyRounds(rounds).active;
  if (active === undefined || active.estado !== "VOTING") {
    return { ok: false, error: "ROUND_NOT_VOTING" };
  }

  const dbNotes = payload.abstain
    ? []
    : payload.notes.map((note) => ({
        id_criterio: Number(note.criterionId),
        valor: note.value,
      }));

  const [row] = await sql<{ resultado: Record<string, unknown> }>`
    select fn_registrar_voto(
             ${jurorId}::bigint,
             ${active.id_ronda}::bigint,
             ${payload.abstain}::boolean,
             ${JSON.stringify(dbNotes)}::jsonb
           ) as resultado`;
  const raw = row?.resultado ?? {};
  const result = normalizeFunctionResult(raw);
  const score =
    raw.puntaje === null || raw.puntaje === undefined ? null : Number(raw.puntaje);
  return { ...result, score };
}

/**
 * Guarda en el borrador la nota de un criterio en la ronda calificable vigente mediante
 * fn_guardar_borrador (RF-14).
 */
export async function saveDraftNote(
  jurorId: string,
  criterionId: string,
  value: number,
): Promise<FunctionResult> {
  await closeExpiredLastCall();
  const [round] = await sql<{ id_ronda: string }>`
    select id_ronda::text as id_ronda
      from ronda
     where estado in ('ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION')
     order by numero
     limit 1`;
  if (round === undefined) {
    return { ok: false, error: "ROUND_NOT_GRADABLE" };
  }

  const [row] = await sql<{ resultado: Record<string, unknown> }>`
    select fn_guardar_borrador(${jurorId}::bigint, ${round.id_ronda}::bigint,
                               ${criterionId}::bigint, ${value}::int) as resultado`;
  return normalizeFunctionResult(row?.resultado ?? {});
}
