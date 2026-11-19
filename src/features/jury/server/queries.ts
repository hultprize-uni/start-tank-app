import type { Decision } from "@/shared/domain/types";
import { sql } from "@/server/db/client";
import { classifyRounds, queryRoundVotes, queryRounds } from "@/server/db/rounds";
import type { StaffMember } from "@/server/db/staff";
import { normalizeFunctionResult, toDbDecision, type FunctionResult } from "@/server/db/values";
import { buildJuryView } from "./mappers";
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

/**
 * Lee el view model del portal del jurado. Devuelve nulo cuando el jurado no existe.
 * Los votos de otros jurados se consultan, pero el view model solo expone conteos.
 */
export async function readJuryView(jurorId: string): Promise<JuryViewModel | null> {
  const juror = await findJurorById(jurorId);
  if (juror === null) return null;

  const rounds = await queryRounds();
  const active = classifyRounds(rounds).active;
  const [votes, totalJurors] = await Promise.all([
    active ? queryRoundVotes(active.id_ronda) : Promise.resolve([]),
    queryJurorCount(),
  ]);

  return buildJuryView({
    jurorId: juror.id,
    name: juror.nombre,
    rounds: rounds,
    votes: votes,
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
