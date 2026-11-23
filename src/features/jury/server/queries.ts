import type { Decision } from "@/shared/domain/types";
import { sql } from "@/server/db/client";
import { classifyRounds, closeExpiredLastCall, queryRoundVotes, queryRounds } from "@/server/db/rounds";
import type { StaffMember } from "@/server/db/staff";
import {
  normalizeFunctionResult,
  toDbDecision,
  toDecision,
  type FunctionResult,
} from "@/server/db/values";
import { buildJuryView, resolveCurrentRound, type OwnVoteRow } from "./mappers";
import type { JuryViewModel } from "../types";

/*
 * Consultas del portal del jurado. Las lecturas delegan el armado del view model en mappers.ts; la
 * escritura del voto se realiza solo mediante la función SQL transaccional fn_registrar_voto.
 */

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

/** Descripción de la startup de una ronda. Nula cuando la ronda no existe o no tiene descripción. */
async function queryRoundDescription(roundId: string): Promise<string | null> {
  const [row] = await sql<{ descripcion: string | null }>`
    select s.descripcion
      from ronda r
      join startup s on s.id_startup = r.id_startup
     where r.id_ronda = ${roundId}::bigint`;
  return row?.descripcion ?? null;
}

/** Votos registrados por el jurado en todas las rondas. */
async function queryOwnVotes(jurorId: string): Promise<OwnVoteRow[]> {
  const rows = await sql<{ id_ronda: string; decision: string }>`
    select v.id_ronda::text as id_ronda,
           v.decision
      from veredicto v
     where v.id_jurado = ${jurorId}::bigint`;
  return rows.map((row) => ({ id_ronda: row.id_ronda, decision: toDecision(row.decision) }));
}

/**
 * Lee el view model del portal del jurado. Devuelve nulo cuando el jurado no existe.
 * Los votos de otros jurados se consultan, pero el view model solo los expone al liquidar la ronda.
 */
export async function readJuryView(jurorId: string): Promise<JuryViewModel | null> {
  const juror = await findJurorById(jurorId);
  if (juror === null) return null;

  const rounds = await queryRounds();
  const current = resolveCurrentRound(rounds).row;
  const [votes, ownVotes, description, totalJurors] = await Promise.all([
    current ? queryRoundVotes(current.id_ronda) : Promise.resolve([]),
    queryOwnVotes(juror.id),
    current ? queryRoundDescription(current.id_ronda) : Promise.resolve(null),
    queryJurorCount(),
  ]);

  return buildJuryView({
    jurorId: juror.id,
    name: juror.nombre,
    rounds,
    votes,
    ownVotes,
    description,
    totalJurors,
  });
}

/**
 * Registra el voto del jurado en la ronda activa mediante fn_registrar_voto. La función valida el
 * estado de la ronda y la unicidad del voto.
 */
export async function registerVote(jurorId: string, decision: Decision): Promise<FunctionResult> {
  const rounds = await queryRounds();
  const active = classifyRounds(rounds).active;
  if (active === undefined) {
    return { ok: false, error: "ROUND_NOT_VOTING" };
  }

  const [row] = await sql<{ resultado: Record<string, unknown> }>`
    select fn_registrar_voto(${jurorId}::bigint, ${active.id_ronda}::bigint, ${toDbDecision(decision)}::varchar) as resultado`;
  return normalizeFunctionResult(row.resultado);
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
