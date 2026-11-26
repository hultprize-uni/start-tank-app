import { EVENT_CONFIG } from "@/shared/domain/config";
import type { Decision, RoundState } from "@/shared/domain/types";
import { juryFraction } from "@/shared/domain/verdict";
import { sql } from "./client";
import { toNumber, toRoundState } from "./values";

/*
 * Filas y consultas de rondas compartidas por la pantalla, el jurado y el operador. Los valores
 * numeric y bigint de Postgres llegan como cadenas y se convierten en los mapeadores de cada
 * funcionalidad. Los estados se traducen aquí, en el límite con la base de datos.
 */

/** Ronda con los datos de su startup y de su fila de startup_leaderboard. */
export interface RoundRow {
  id_ronda: string;
  numero: number;
  estado: RoundState;
  multiplicador: string | null;
  /** Segundos transcurridos desde el inicio de la última llamada. Nulo fuera de esa fase. */
  segundos_ultima_llamada: number | null;
  /** Hora ISO en que termina la fase actual. Nula sin cronómetro o en pausa. */
  fase_termina_en: string | null;
  /** Segundos guardados al pausar. Nulo fuera de pausa. */
  segundos_restantes_pausa: number | null;
  /** Hora ISO de la liquidación. Nula hasta liquidar. */
  liquidada_en: string | null;
  startup_nombre: string;
  ods: string | null;
  monto_acumulado: string | null;
  inversores_unicos: number | null;
  precio_vivo: string | null;
  /** Promedio de los puntajes del jurado, de 1 a 5. Nulo hasta revelar. */
  puntaje_jurado: string | null;
  /**
   * Fracción equivalente del jurado, (puntaje - 1) / 4, entre 0 y 1. Ocupa el lugar de la antigua
   * fracción de respaldo en las vistas que aún no migran (F5 y F6).
   */
  fraccion_respaldo: string | null;
  puntaje: string | null;
  monto_invertido: string;
  retorno_ronda: string;
}

/** Fila tal como la devuelve Postgres, con el estado en el valor de la base de datos. */
interface RawRoundRow extends Omit<RoundRow, "estado" | "fraccion_respaldo"> {
  estado: string;
}

/**
 * Envío de un jurado en una ronda. Las notas no se exponen: el operador solo ve quién envió y el
 * escenario recibe el puntaje al revelar.
 */
export interface RoundVoteRow {
  id_jurado: string;
  nombre: string;
  enviado: boolean;
  se_abstiene: boolean;
  /** Puntaje de 1 a 5 del jurado. Nulo si no envió o se abstuvo. */
  puntaje: string | null;
  /**
   * @deprecated Equivalente con las reglas anteriores para las vistas que aún no migran: ABSTAIN
   * al abstenerse; BACK con puntaje mayor que 3; REJECT con 3 o menos. Nulo sin envío.
   */
  decision: Decision | null;
}

/** Estados en los que una ronda ocupa el turno de la sala. Solo puede existir una a la vez. */
const ACTIVE_STATES: ReadonlySet<RoundState> = new Set<RoundState>([
  "PITCH",
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

/**
 * Cierra la última llamada vencida antes de leer (RF-08), para que ninguna vista muestre el
 * mercado abierto después del plazo aunque nadie haya pulsado Cerrar.
 */
export async function closeExpiredLastCall(): Promise<void> {
  await sql`select fn_cerrar_ultima_llamada_vencida()`;
}

/** Todas las rondas con los datos de su startup y de su fila de startup_leaderboard. */
export async function queryRounds(): Promise<RoundRow[]> {
  await closeExpiredLastCall();
  const rows = await sql<RawRoundRow>`
    select r.id_ronda::text as id_ronda,
           r.numero,
           r.estado,
           r.multiplicador::text as multiplicador,
           extract(epoch from (now() - r.ultima_llamada_en))::float8 as segundos_ultima_llamada,
           to_char(r.fase_termina_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as fase_termina_en,
           r.segundos_restantes_pausa,
           to_char(r.liquidada_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as liquidada_en,
           s.nombre as startup_nombre,
           s.ods,
           sl.monto_acumulado::text as monto_acumulado,
           sl.inversores_unicos,
           sl.precio_vivo::text as precio_vivo,
           sl.puntaje_jurado::text as puntaje_jurado,
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
  return rows.map((row) => ({
    ...row,
    estado: toRoundState(row.estado),
    fraccion_respaldo:
      row.puntaje_jurado === null ? null : String(juryFraction(toNumber(row.puntaje_jurado))),
  }));
}

/** Decisión equivalente con las reglas anteriores; ver RoundVoteRow.decision. */
function legacyDecision(sent: boolean, abstains: boolean, score: string | null): Decision | null {
  if (!sent) return null;
  if (abstains || score === null) return "ABSTAIN";
  return toNumber(score) > 3 ? "BACK" : "REJECT";
}

/** Envíos de todos los jurados en una ronda. */
export async function queryRoundVotes(roundId: string): Promise<RoundVoteRow[]> {
  const rows = await sql<Omit<RoundVoteRow, "decision">>`
    select j.id_jurado::text as id_jurado,
           j.nombre,
           (v.id_veredicto is not null) as enviado,
           coalesce(v.se_abstiene, false) as se_abstiene,
           v.puntaje::text as puntaje
      from jurado j
      left join veredicto v
        on v.id_jurado = j.id_jurado
       and v.id_ronda = ${roundId}::bigint
     order by j.id_jurado`;
  return rows.map((row) => ({
    ...row,
    decision: legacyDecision(row.enviado, row.se_abstiene, row.puntaje),
  }));
}

/** Número de asistentes registrados. */
export async function queryActiveUsers(): Promise<number> {
  const [row] = await sql<{ total: number }>`select count(*)::int as total from usuario`;
  return row?.total ?? 0;
}
