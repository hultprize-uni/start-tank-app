import type { Decision } from "@/shared/domain/types";
import { sql } from "@/server/db/client";
import {
  normalizeFunctionResult,
  toDecision,
  toRoundState,
  type FunctionResult,
} from "@/server/db/values";
import {
  buildParticipantState,
  finishedRoundsOf,
  type ParticipantLeaderboardRow,
  type ParticipantRoundRow,
  type UserInvestmentRow,
} from "./mappers";
import type { ParticipantViewModel } from "../types";

/*
 * Consultas del portal del participante. Las lecturas delegan el armado del view model en
 * mappers.ts. La escritura de inversiones se realiza solo mediante fn_registrar_inversion, que
 * valida las reglas en la transacción.
 */

/** Fila de ronda tal como la devuelve Postgres, con el estado en el valor de la base de datos. */
interface RawParticipantRoundRow extends Omit<ParticipantRoundRow, "estado"> {
  estado: string;
}

/** Saldo actual del asistente. */
async function queryBalance(userId: number): Promise<number> {
  const [row] = await sql<{ saldo: string }>`
    select saldo_actual::text as saldo
      from usuario
     where id_usuario = ${userId}::bigint`;
  return Number(row?.saldo ?? 0);
}


/** Todas las rondas con los datos de su startup y de su fila de startup_leaderboard. */
async function queryParticipantRounds(): Promise<ParticipantRoundRow[]> {
  const rows = await sql<RawParticipantRoundRow>`
    select r.id_ronda::text as id_ronda,
           r.numero,
           r.estado,
           r.multiplicador::text as multiplicador,
           extract(epoch from (now() - r.ultima_llamada_en))::float8 as segundos_ultima_llamada,
           s.nombre as startup_nombre,
           s.ods,
           s.descripcion,
           sl.monto_acumulado::text as monto_acumulado,
           sl.inversores_unicos,
           sl.precio_vivo::text as precio_vivo
      from ronda r
      join startup s on s.id_startup = r.id_startup
      left join startup_leaderboard sl on sl.id_ronda = r.id_ronda
     order by r.numero`;
  return rows.map((row) => ({ ...row, estado: toRoundState(row.estado) }));
}

/** Montos y retornos del asistente agrupados por ronda. */
async function queryUserInvestments(userId: number): Promise<UserInvestmentRow[]> {
  return sql<UserInvestmentRow>`
    select i.id_ronda::text as id_ronda,
           sum(i.monto)::text as monto,
           coalesce(sum(i.retorno), 0)::text as retorno
      from inversion i
     where i.id_usuario = ${userId}::bigint
     group by i.id_ronda`;
}


/** Decisiones emitidas por los jurados en una ronda. */
async function queryDecisions(roundId: string): Promise<Decision[]> {
  const rows = await sql<{ decision: string }>`
    select v.decision
      from veredicto v
     where v.id_ronda = ${roundId}::bigint`;
  return rows.map((row) => toDecision(row.decision));
}


/** Primeras tres filas del leaderboard de una ronda. */
async function queryTopThree(roundId: string): Promise<ParticipantLeaderboardRow[]> {
  return sql<ParticipantLeaderboardRow>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.posicion,
           l.saldo::text as saldo,
           l.aciertos
      from leaderboard l
      join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${roundId}::bigint
     order by l.posicion
     limit 3`;
}

/** Fila del asistente en el leaderboard de una ronda, si existe. */
async function queryLeaderboardRow(
  roundId: string,
  userId: number,
): Promise<ParticipantLeaderboardRow | null> {
  const [row] = await sql<ParticipantLeaderboardRow>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.posicion,
           l.saldo::text as saldo,
           l.aciertos
      from leaderboard l
      join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${roundId}::bigint
       and l.id_usuario = ${userId}::bigint`;
  return row ?? null;
}

/** Número de filas del leaderboard de una ronda. */
async function queryParticipantCount(roundId: string): Promise<number> {
  const [row] = await sql<{ total: number }>`
    select count(*)::int as total
      from leaderboard
     where id_ronda = ${roundId}::bigint`;
  return row?.total ?? 0;
}

/**
 * Lee el view model del inversionista para la sesión indicada. Las consultas del leaderboard se
 * ejecutan solo cuando existe una ronda terminada.
 */
export async function readParticipantState(userId: number): Promise<ParticipantViewModel> {
  const [balance, rounds, investments] = await Promise.all([
    queryBalance(userId),
    queryParticipantRounds(),
    queryUserInvestments(userId),
  ]);

  const finishedRounds = finishedRoundsOf(rounds);
  const last = finishedRounds[finishedRounds.length - 1];
  const previous = finishedRounds[finishedRounds.length - 2];

  let lastDecisions: Decision[] = [];
  let topThreeRows: ParticipantLeaderboardRow[] = [];
  let ownRow: ParticipantLeaderboardRow | null = null;
  let participants = 0;
  if (last !== undefined) {
    [lastDecisions, topThreeRows, ownRow, participants] = await Promise.all([
      queryDecisions(last.id_ronda),
      queryTopThree(last.id_ronda),
      queryLeaderboardRow(last.id_ronda, userId),
      queryParticipantCount(last.id_ronda),
    ]);
  }

  let previousPosition: number | null = null;
  if (previous !== undefined) {
    const previousRow = await queryLeaderboardRow(previous.id_ronda, userId);
    previousPosition = previousRow?.posicion ?? null;
  }

  return buildParticipantState({
    userId,
    balance,
    rounds,
    investments,
    lastDecisions,
    topThreeRows,
    ownRow,
    participants,
    previousPosition,
  });
}


/**
 * Registra una inversión del asistente en la ronda abierta mediante fn_registrar_inversion. El
 * identificador del asistente lo fija el servidor a partir de la sesión, nunca el cuerpo de la
 * petición. Si no hay ronda abierta, devuelve ROUND_NOT_OPEN sin invocar la función.
 */
export async function registerInvestment(userId: number, amount: number): Promise<FunctionResult> {
  const [active] = await sql<{ id_ronda: string }>`
    select r.id_ronda::text as id_ronda
      from ronda r
     where r.estado in ('ABIERTA', 'ULTIMA_LLAMADA')
     order by r.numero
     limit 1`;
  if (active === undefined) {
    return { ok: false, error: "ROUND_NOT_OPEN" };
  }

  const [row] = await sql<{ resultado: Record<string, unknown> }>`
    select fn_registrar_inversion(${userId}::bigint, ${active.id_ronda}::bigint, ${amount}::numeric) as resultado`;
  if (row === undefined) {
    return { ok: false, error: "INTERNAL_ERROR" };
  }
  return normalizeFunctionResult(row.resultado);
}
