import { sql } from "@/server/db/client";
import {
  classifyRounds,
  queryActiveUsers,
  queryRoundVotes,
  queryRounds,
} from "@/server/db/rounds";
import { buildScreen, screenReferenceRound, type RankingRow } from "./mappers";
import type { ScreenViewModel } from "../types";

/*
 * Consultas de lectura de la pantalla pública. Cada función obtiene las filas necesarias y delega
 * el armado del view model en los constructores de mappers.ts. No ejecuta escrituras.
 */

/** Límite de filas del leaderboard, dimensionado para hasta 100 asistentes. */
const RANKING_LIMIT = 100;

/** Leaderboard de asistentes de una ronda, ordenado por posición. */
async function queryRanking(roundId: string): Promise<RankingRow[]> {
  return sql<RankingRow>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.posicion,
           l.saldo::text as saldo,
           l.aciertos
      from leaderboard l
      join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${roundId}::bigint
     order by l.posicion
     limit ${RANKING_LIMIT}`;
}

/**
 * Lee el view model de la pantalla pública. Devuelve nulo cuando el evento no tiene rondas.
 * Solo ejecuta consultas de lectura.
 */
export async function readScreen(now: Date = new Date()): Promise<ScreenViewModel | null> {
  const rounds = await queryRounds();
  const reference = screenReferenceRound(rounds);
  if (reference === undefined) return null;

  const lastFinished = classifyRounds(rounds).lastFinished;
  const [votes, ranking, activeUsers] = await Promise.all([
    queryRoundVotes(reference.id_ronda),
    lastFinished ? queryRanking(lastFinished.id_ronda) : Promise.resolve([]),
    queryActiveUsers(),
  ]);

  return buildScreen({ rounds: rounds, votes: votes, ranking, activeUsers: activeUsers }, now);
}
