import { EVENT_CONFIG } from "@/shared/domain/config";
import type { Decision, RoundState } from "@/shared/domain/types";
import { sql } from "./client";
import { toDecision, toNumber, toRoundState } from "./values";

/*
 * Filas y consultas de rondas compartidas por la pantalla, el jurado y el operador. Los valores
 * numeric y bigint de Postgres llegan como cadenas y se convierten en los mapeadores de cada
 * funcionalidad. Los estados y las decisiones se traducen aquí, en el límite con la base de datos.
 */

/** Ronda con los datos de su startup y de su fila de startup_leaderboard. */
export interface RoundRow {
  id_ronda: string;
  numero: number;
  estado: RoundState;
  multiplicador: string | null;
  /** Segundos transcurridos desde el inicio de la última llamada. Nulo fuera de esa fase. */
  segundos_ultima_llamada: number | null;
  startup_nombre: string;
  ods: string | null;
  monto_acumulado: string | null;
  inversores_unicos: number | null;
  precio_vivo: string | null;
  fraccion_respaldo: string | null;
  puntaje: string | null;
  monto_invertido: string;
  retorno_ronda: string;
}

/** Fila tal como la devuelve Postgres, con el estado en el valor de la base de datos. */
interface RawRoundRow extends Omit<RoundRow, "estado"> {
  estado: string;
}

/** Voto de un jurado en una ronda. Decision es nula cuando el jurado aún no ha votado. */
export interface RoundVoteRow {
  id_jurado: string;
  nombre: string;
  decision: Decision | null;
}

/** Fila tal como la devuelve Postgres, con la decisión en el valor de la base de datos. */
interface RawVoteRow extends Omit<RoundVoteRow, "decision"> {
  decision: string | null;
}

/** Estados en los que una ronda ocupa el turno de la sala. Solo puede existir una a la vez. */
const ACTIVE_STATES: ReadonlySet<RoundState> = new Set<RoundState>([
  "OPEN",
  "LAST_CALL",
  "CLOSED",
  "VOTING",
]);

/** Ordena las rondas por número ascendente sin modificar la lista original. */
export function sortRounds(rounds: readonly RoundRow[]): RoundRow[] {
  return [...rounds].sort((a, b) => a.numero - b.numero);
}

export interface RoundClassification {
  /** Ronda en curso: OPEN, LAST_CALL, CLOSED o VOTING. */
  active: RoundRow | undefined;
  /** Primera ronda aún no abierta. */
  pending: RoundRow | undefined;
  /** Última ronda liquidada o anulada. */
  lastFinished: RoundRow | undefined;
}

/** Clasifica las rondas según su estado para determinar la ronda en curso y las de referencia. */
export function classifyRounds(rounds: readonly RoundRow[]): RoundClassification {
  const sorted = sortRounds(rounds);
  const finished = sorted.filter((r) => r.estado === "SETTLED" || r.estado === "CANCELLED");
  return {
    active: sorted.find((r) => ACTIVE_STATES.has(r.estado)),
    pending: sorted.find((r) => r.estado === "SCHEDULED"),
    lastFinished: finished[finished.length - 1],
  };
}

export function priceOf(row: RoundRow): number {
  return row.precio_vivo === null ? EVENT_CONFIG.priceBase : toNumber(row.precio_vivo);
}

export function accumulatedOf(row: RoundRow): number {
  return toNumber(row.monto_acumulado);
}

/** Todas las rondas con los datos de su startup y de su fila de startup_leaderboard. */
export async function queryRounds(): Promise<RoundRow[]> {
  const rows = await sql<RawRoundRow>`
    select r.id_ronda::text as id_ronda,
           r.numero,
           r.estado,
           r.multiplicador::text as multiplicador,
           extract(epoch from (now() - r.ultima_llamada_en))::float8 as segundos_ultima_llamada,
           s.nombre as startup_nombre,
           s.ods,
           sl.monto_acumulado::text as monto_acumulado,
           sl.inversores_unicos,
           sl.precio_vivo::text as precio_vivo,
           sl.fraccion_respaldo::text as fraccion_respaldo,
           sl.puntaje::text as puntaje,
           (select coalesce(sum(i.monto), 0)::text
              from inversion i
             where i.id_ronda = r.id_ronda) as monto_invertido,
           (select coalesce(sum(i.retorno), 0)::text
              from inversion i
             where i.id_ronda = r.id_ronda) as retorno_ronda
      from ronda r
      join startup s on s.id_startup = r.id_startup
      left join startup_leaderboard sl on sl.id_ronda = r.id_ronda
     order by r.numero`;
  return rows.map((row) => ({ ...row, estado: toRoundState(row.estado) }));
}

/** Votos de todos los jurados en una ronda. La decisión es nula para quien aún no votó. */
export async function queryRoundVotes(roundId: string): Promise<RoundVoteRow[]> {
  const rows = await sql<RawVoteRow>`
    select j.id_jurado::text as id_jurado,
           j.nombre,
           v.decision
      from jurado j
      left join veredicto v
        on v.id_jurado = j.id_jurado
       and v.id_ronda = ${roundId}::bigint
     order by j.id_jurado`;
  return rows.map((row) => ({
    ...row,
    decision: row.decision === null ? null : toDecision(row.decision),
  }));
}

/** Número de asistentes con cuenta activa. */
export async function queryActiveUsers(): Promise<number> {
  const [row] = await sql<{ total: number }>`
    select count(*)::int as total
      from usuario
     where estado = 'ACTIVO'`;
  return row?.total ?? 0;
}
