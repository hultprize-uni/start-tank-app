import { sql } from "@/server/db/client";
import { readEventConfig } from "@/server/db/config";
import { classifyRounds, queryRoundVotes, queryRounds } from "@/server/db/rounds";
import { buildScreen, resolvePhase, type RankingRow, type StartupExtra } from "./mappers";
import type { ScreenViewModel } from "../types";

/*
 * Consultas de la pantalla pública (RF-25). Solo lecturas: la pantalla no tiene sesión ni escribe.
 * El único efecto es el cierre automático de la última llamada vencida que hace queryRounds.
 */

const ISO = "YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"";

async function queryStartupExtras(): Promise<Map<string, StartupExtra>> {
  const rows = await sql<StartupExtra & { id_ronda: string }>`
    select r.id_ronda::text as id_ronda, s.descripcion, s.logo_url
      from ronda r join startup s on s.id_startup = r.id_startup`;
  return new Map(rows.map((row) => [row.id_ronda, row]));
}

async function queryInvestments(roundId: string) {
  return sql<{ monto: string; creada_en: string }>`
    select monto::text as monto,
           to_char(creada_en at time zone 'UTC', ${ISO}) as creada_en
      from inversion
     where id_ronda = ${roundId}::bigint
     order by creada_en, id_inversion`;
}

async function queryActions(roundId: string) {
  return sql<{ accion: string; ejecutada_en: string }>`
    select a.accion, to_char(a.ejecutada_en at time zone 'UTC', ${ISO}) as ejecutada_en
      from accion_ronda a join ronda r on r.id_ronda = a.id_ronda
     where a.id_ronda = ${roundId}::bigint
       -- Solo desde la apertura vigente: tras reiniciar la ronda, su log anterior no vuelve al feed.
       and a.ejecutada_en >= r.abierta_en
     order by a.ejecutada_en`;
}

async function queryJuryTimes(roundId: string): Promise<string[]> {
  const rows = await sql<{ emitido_en: string }>`
    select to_char(emitido_en at time zone 'UTC', ${ISO}) as emitido_en
      from veredicto
     where id_ronda = ${roundId}::bigint
     order by emitido_en`;
  return rows.map((row) => row.emitido_en);
}

/**
 * Top 8 del corte indicado. Sin corte, por patrimonio vivo: saldo disponible más lo invertido aún
 * sin liquidar, para que invertir no haga caer a nadie en la tabla (BASES 3.3).
 */
async function queryRanking(roundId: string | undefined): Promise<RankingRow[]> {
  if (roundId === undefined) {
    return sql<RankingRow>`
      with patrimonio as (
        select u.id_usuario, u.nombre,
               u.saldo_actual + coalesce(sum(i.monto) filter (where i.retorno is null), 0) as total
          from usuario u left join inversion i on i.id_usuario = u.id_usuario
         group by u.id_usuario
      )
      select id_usuario::text as id_usuario,
             coalesce(nombre, 'Asistente ' || id_usuario::text) as nombre,
             (row_number() over (order by total desc, id_usuario))::int as posicion,
             total::text as saldo,
             0 as aciertos
        from patrimonio
       order by total desc, id_usuario
       limit 8`;
  }
  return sql<RankingRow>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.posicion, l.saldo::text as saldo, l.aciertos
      from leaderboard l join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${roundId}::bigint
     order by l.posicion
     limit 8`;
}

async function queryPositions(roundId: string | undefined): Promise<Map<string, number>> {
  if (roundId === undefined) return new Map();
  const rows = await sql<{ id_usuario: string; posicion: number }>`
    select id_usuario::text as id_usuario, posicion from leaderboard where id_ronda = ${roundId}::bigint`;
  return new Map(rows.map((row) => [row.id_usuario, row.posicion]));
}

async function queryBestEye(roundId: string | undefined) {
  if (roundId === undefined) return null;
  const [row] = await sql<{ nombre: string; aciertos: number }>`
    select coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre, l.aciertos
      from leaderboard l join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${roundId}::bigint
     order by l.aciertos desc, l.posicion
     limit 1`;
  return row ?? null;
}

/** Lee el modelo del escenario. Devuelve nulo cuando el evento no tiene rondas. */
export async function readScreen(now: Date = new Date()): Promise<ScreenViewModel | null> {
  const [rounds, { config, flags }, extras, attendeeRows] = await Promise.all([
    queryRounds(),
    readEventConfig(),
    queryStartupExtras(),
    sql<{ total: number }>`select count(*)::int as total from usuario`,
  ]);
  const { reference } = resolvePhase(rounds, now);
  if (reference === undefined) return null;

  const finished = rounds
    .filter((r) => r.estado === "SETTLED" || r.estado === "CANCELLED")
    .sort((a, b) => a.numero - b.numero);
  const cut = classifyRounds(rounds).lastFinished?.id_ronda;
  const previousCut = finished[finished.length - 2]?.id_ronda;

  const [votes, juryTimes, investments, actions, ranking, previousPositions, bestEye] = await Promise.all([
    queryRoundVotes(reference.id_ronda),
    queryJuryTimes(reference.id_ronda),
    queryInvestments(reference.id_ronda),
    queryActions(reference.id_ronda),
    queryRanking(cut),
    queryPositions(previousCut),
    queryBestEye(cut),
  ]);

  return buildScreen({
    now,
    config,
    manualMode: flags.manualMode,
    rounds,
    startups: extras,
    votes,
    juryTimes,
    investments,
    actions,
    ranking,
    previousPositions,
    attendees: attendeeRows[0]?.total ?? 0,
    bestEye,
  });
}
