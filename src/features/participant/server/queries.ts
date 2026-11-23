import { sql } from "@/server/db/client";
import { closeExpiredLastCall } from "@/server/db/rounds";
import { normalizeFunctionResult, toRoundState, type FunctionResult } from "@/server/db/values";
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

interface RawParticipantRoundRow extends Omit<ParticipantRoundRow, "estado"> {
  estado: string;
}

async function queryBalance(userId: number): Promise<number> {
  const [row] = await sql<{ saldo: string }>`
    select saldo_actual::text as saldo from usuario where id_usuario = ${userId}::bigint`;
  return Number(row?.saldo ?? 0);
}

async function queryParticipantRounds(): Promise<ParticipantRoundRow[]> {
  const rows = await sql<RawParticipantRoundRow>`
    select r.id_ronda::text as id_ronda,
           r.numero,
           r.estado,
           r.multiplicador::text as multiplicador,
           to_char(r.fase_termina_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as fase_termina_en,
           r.segundos_restantes_pausa,
           to_char(r.liquidada_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as liquidada_en,
           s.nombre as startup_nombre,
           s.ods,
           s.descripcion,
           s.logo_url,
           sl.monto_acumulado::text as monto_acumulado,
           sl.inversores_unicos,
           sl.precio_vivo::text as precio_vivo,
           sl.puntaje_jurado::text as puntaje_jurado
      from ronda r
      join startup s on s.id_startup = r.id_startup
      left join startup_leaderboard sl on sl.id_ronda = r.id_ronda
     order by r.numero`;
  return rows.map((row) => ({ ...row, estado: toRoundState(row.estado) }));
}

/** Monto y retorno del asistente por ronda. Hay una sola inversión por ronda. */
async function queryUserInvestments(userId: number): Promise<UserInvestmentRow[]> {
  return sql<UserInvestmentRow>`
    select i.id_ronda::text as id_ronda,
           i.monto::text as monto,
           coalesce(i.retorno, 0)::text as retorno
      from inversion i
     where i.id_usuario = ${userId}::bigint`;
}

/** Rondas que el operador liquidó a 1.0x; la devolución se identifica por el estado ANULADA. */
async function queryRoundsSettledAtOne(): Promise<string[]> {
  const rows = await sql<{ id_ronda: string }>`
    select distinct a.id_ronda::text as id_ronda
      from accion_ronda a
     where a.accion = 'ANULAR_LIQUIDAR_1X'`;
  return rows.map((row) => row.id_ronda);
}

/** Startup con el mayor puntaje final, que existe solo después del cierre del evento. */
async function queryWinnerStartup(): Promise<string | null> {
  const [row] = await sql<{ nombre: string }>`
    select s.nombre
      from startup_leaderboard sl
      join startup s on s.id_startup = sl.id_startup
     where sl.puntaje is not null
     order by sl.puntaje desc, sl.puntaje_jurado desc nulls last
     limit 1`;
  return row?.nombre ?? null;
}

/** Filas del leaderboard de una ronda entre dos posiciones, inclusive. */
async function queryLeaderboardRange(
  roundId: string,
  from: number,
  to: number,
): Promise<ParticipantLeaderboardRow[]> {
  return sql<ParticipantLeaderboardRow>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.posicion,
           l.saldo::text as saldo,
           l.aciertos
      from leaderboard l
      join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${roundId}::bigint
       and l.posicion between ${from} and ${to}
     order by l.posicion`;
}

async function queryOwnRow(roundId: string, userId: number): Promise<ParticipantLeaderboardRow | null> {
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

async function queryParticipantCount(roundId: string): Promise<number> {
  const [row] = await sql<{ total: number }>`
    select count(*)::int as total from leaderboard where id_ronda = ${roundId}::bigint`;
  return row?.total ?? 0;
}

/** Posiciones de la ronda anterior para los asistentes indicados, por identificador. */
async function queryPositions(roundId: string, userIds: readonly string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await sql<{ id_usuario: string; posicion: number }>`
    select id_usuario::text as id_usuario, posicion
      from leaderboard
     where id_ronda = ${roundId}::bigint
       and id_usuario = any(${userIds.map(Number)}::bigint[])`;
  return new Map(rows.map((row) => [row.id_usuario, row.posicion]));
}

/**
 * Lee el view model del inversionista para la sesión indicada y registra su latido de conexión.
 * Antes de leer, cierra la última llamada vencida (RF-08).
 */
export async function readParticipantState(userId: number): Promise<ParticipantViewModel> {
  await closeExpiredLastCall();
  const [balance, rounds, investments, settledAtOneRoundIds, winnerStartup] = await Promise.all([
    queryBalance(userId),
    queryParticipantRounds(),
    queryUserInvestments(userId),
    queryRoundsSettledAtOne(),
    queryWinnerStartup(),
    sql`select fn_latido_usuario(${userId}::bigint)`,
  ]);

  const finished = finishedRoundsOf(rounds);
  const last = finished[finished.length - 1];
  const previous = finished[finished.length - 2];

  let topThreeRows: ParticipantLeaderboardRow[] = [];
  let windowRows: ParticipantLeaderboardRow[] = [];
  let ownRow: ParticipantLeaderboardRow | null = null;
  let participants = 0;
  let previousPositions = new Map<string, number>();
  if (last !== undefined) {
    [topThreeRows, ownRow, participants] = await Promise.all([
      queryLeaderboardRange(last.id_ronda, 1, 3),
      queryOwnRow(last.id_ronda, userId),
      queryParticipantCount(last.id_ronda),
    ]);
    if (ownRow !== null) {
      windowRows = await queryLeaderboardRange(last.id_ronda, ownRow.posicion - 2, ownRow.posicion + 2);
    }
    if (previous !== undefined) {
      const ids = [...new Set([...topThreeRows, ...windowRows].map((row) => row.id_usuario))];
      previousPositions = await queryPositions(previous.id_ronda, ids);
    }
  }

  return buildParticipantState({
    userId,
    balance,
    rounds,
    investments,
    topThreeRows,
    windowRows,
    ownRow,
    participants,
    previousPositions,
    settledAtOneRoundIds,
    winnerStartup,
    now: new Date(),
  });
}

/**
 * Registra una inversión del asistente en la ronda abierta mediante fn_registrar_inversion. El
 * identificador del asistente lo fija el servidor a partir de la sesión, nunca el cuerpo.
 */
export async function registerInvestment(userId: number, amount: number): Promise<FunctionResult> {
  await closeExpiredLastCall();
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
