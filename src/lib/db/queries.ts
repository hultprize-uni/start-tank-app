import type { Decision } from "@/shared/domain/types";
import type { JuryViewModel } from "@/lib/api/jury.types";
import type { OperatorViewModel } from "@/lib/api/operator.types";
import type { ScreenViewModel } from "@/features/screen/types";
import { sql } from "../../server/db/client";
import {
  classifyRounds,
  buildScreen,
  buildJuryView,
  buildOperatorView,
  operatorReferenceRound,
  screenReferenceRound,
  type ActionRow,
  type AttendeePositionRow,
  type RankingRow,
  type RoundRow,
  type BalanceSnapshotRow,
  type RoundVoteRow,
} from "./mapeo";

/*
 * Consultas tipadas de la capa de datos. Cada función de lectura obtiene las filas necesarias y
 * delega el armado del view model en los constructores de mapeo.ts. Las escrituras se realizan
 * solo mediante las funciones SQL transaccionales de la base de datos.
 */

/** Acciones del operador que la API acepta. REVELAR se resuelve con fn_revelar_veredicto. */
export const API_OPERATOR_ACTIONS = [
  "OPEN",
  "LAST_CALL",
  "CLOSE",
  "ENABLE_VOTING",
  "REVEAL",
  "CANCEL_REFUND",
  "CANCEL_SETTLE_1X",
] as const;

export type ApiOperatorAction = (typeof API_OPERATOR_ACTIONS)[number];

/** Resultado jsonb devuelto por las funciones SQL. */
export interface SqlFunctionResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/** Identidad de un jurado u operador, tal como se almacena en la base de datos. */
export interface Participant {
  id: string;
  nombre: string;
}

/** Límite de filas del leaderboard, dimensionado para hasta 100 asistentes. */
const RANKING_LIMIT = 100;

/** Límite de acciones mostradas en el registro del operador. */
const ACTION_LIMIT = 50;

/** Todas las rondas con los datos de su startup y de su fila de startup_leaderboard. */
async function queryRounds(): Promise<RoundRow[]> {
  return sql<RoundRow>`
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
}

/** Votos de todos los jurados en una ronda. La decisión es nula para quien aún no votó. */
async function queryRoundVotes(roundId: string): Promise<RoundVoteRow[]> {
  return sql<RoundVoteRow>`
    select j.id_jurado::text as id_jurado,
           j.nombre,
           v.decision
      from jurado j
      left join veredicto v
        on v.id_jurado = j.id_jurado
       and v.id_ronda = ${roundId}::bigint
     order by j.id_jurado`;
}

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

/** Número de asistentes con cuenta activa. */
async function queryActiveUsers(): Promise<number> {
  const [row] = await sql<{ total: number }>`
    select count(*)::int as total
      from usuario
     where estado = 'ACTIVO'`;
  return row?.total ?? 0;
}

/** Número de jurados registrados. */
async function queryJurorCount(): Promise<number> {
  const [row] = await sql<{ total: number }>`select count(*)::int as total from jurado`;
  return row?.total ?? 0;
}

/** Saldos actuales de todos los asistentes. */
async function queryBalances(): Promise<BalanceSnapshotRow[]> {
  return sql<BalanceSnapshotRow>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           u.saldo_actual::text as saldo_actual
      from usuario u
     order by u.saldo_actual desc, u.id_usuario`;
}

/** Posiciones por asistente y ronda: monto invertido y retorno, si la ronda ya está liquidada. */
async function queryPositions(): Promise<AttendeePositionRow[]> {
  return sql<AttendeePositionRow>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           r.numero,
           s.nombre as startup_nombre,
           sum(i.monto)::text as monto,
           case when count(*) filter (where i.retorno is null) = 0
                then sum(i.retorno)::text
           end as retorno
      from inversion i
      join usuario u on u.id_usuario = i.id_usuario
      join ronda r on r.id_ronda = i.id_ronda
      join startup s on s.id_startup = r.id_startup
     group by u.id_usuario, u.nombre, r.numero, s.nombre
     order by r.numero, u.nombre`;
}

/** Última acción de anulación registrada para una ronda, si existe. */
async function queryCancelAction(roundId: string): Promise<string | null> {
  const [row] = await sql<{ accion: string }>`
    select a.accion
      from accion_ronda a
     where a.id_ronda = ${roundId}::bigint
       and a.accion in ('ANULAR_DEVOLVER', 'ANULAR_LIQUIDAR_1X')
     order by a.id_accion desc
     limit 1`;
  return row?.accion ?? null;
}

/** Acciones recientes del operador, de la más nueva a la más antigua. */
async function queryActions(): Promise<ActionRow[]> {
  return sql<ActionRow>`
    select a.id_accion::text as id_accion,
           a.accion,
           a.ejecutada_en,
           o.nombre as operador,
           r.numero,
           s.nombre as startup_nombre
      from accion_ronda a
      join operador o on o.id_operador = a.id_operador
      join ronda r on r.id_ronda = a.id_ronda
      join startup s on s.id_startup = r.id_startup
     order by a.id_accion desc
     limit ${ACTION_LIMIT}`;
}

/** Busca un jurado por su código de acceso. */
export async function findJurorByCode(code: string): Promise<Participant | null> {
  const [row] = await sql<Participant>`
    select id_jurado::text as id, nombre
      from jurado
     where codigo_acceso = ${code}
     limit 1`;
  return row ?? null;
}

/** Busca un operador por su código de acceso. */
export async function findOperatorByCode(code: string): Promise<Participant | null> {
  const [row] = await sql<Participant>`
    select id_operador::text as id, nombre
      from operador
     where codigo_acceso = ${code}
     limit 1`;
  return row ?? null;
}

/** Busca un jurado por su identificador de sesión. */
async function findJurorById(id: string): Promise<Participant | null> {
  const [row] = await sql<Participant>`
    select id_jurado::text as id, nombre
      from jurado
     where id_jurado = ${id}::bigint`;
  return row ?? null;
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

/** Lee el view model completo de la consola del operador. Devuelve nulo cuando no hay rondas. */
export async function readOperatorView(now: Date = new Date()): Promise<OperatorViewModel | null> {
  const rounds = await queryRounds();
  const current = operatorReferenceRound(rounds);
  if (current === undefined) return null;

  const [votes, cancelAction, activeUsers, balances, positions, actions] = await Promise.all([
    queryRoundVotes(current.id_ronda),
    queryCancelAction(current.id_ronda),
    queryActiveUsers(),
    queryBalances(),
    queryPositions(),
    queryActions(),
  ]);

  return buildOperatorView({
    rounds: rounds,
    votes: votes,
    cancelAction: cancelAction,
    activeUsers: activeUsers,
    balances: balances,
    positions: positions,
    actions: actions,
    now: now,
  });
}

/**
 * Registra el voto del jurado en la ronda activa mediante fn_registrar_voto. La función valida el
 * estado de la ronda y la unicidad del voto.
 */
export async function registerVote(jurorId: string, decision: Decision): Promise<SqlFunctionResult> {
  const rounds = await queryRounds();
  const active = classifyRounds(rounds).active;
  if (active === undefined) {
    return { ok: false, error: "ROUND_NOT_VOTING" };
  }

  const [row] = await sql<{ resultado: SqlFunctionResult }>`
    select fn_registrar_voto(${jurorId}::bigint, ${active.id_ronda}::bigint, ${decision}::varchar) as resultado`;
  return row.resultado;
}

/**
 * Ejecuta una acción del operador sobre la ronda que le corresponde. ABRIR actúa sobre la siguiente
 * ronda programada y el resto sobre la ronda activa. REVELAR llama a fn_revelar_veredicto y las
 * demás acciones a fn_accion_operador.
 */
export async function executeOperatorAction(
  operatorId: string,
  action: ApiOperatorAction,
): Promise<SqlFunctionResult> {
  const rounds = await queryRounds();
  const c = classifyRounds(rounds);
  const round = action === "OPEN" ? c.pending : c.active;
  if (round === undefined) {
    return { ok: false, error: "ROUND_UNAVAILABLE" };
  }

  if (action === "REVEAL") {
    const [row] = await sql<{ resultado: SqlFunctionResult }>`
      select fn_revelar_veredicto(${operatorId}::bigint, ${round.id_ronda}::bigint) as resultado`;
    return row.resultado;
  }

  const [row] = await sql<{ resultado: SqlFunctionResult }>`
    select fn_accion_operador(${operatorId}::bigint, ${round.id_ronda}::bigint, ${action}::varchar) as resultado`;
  return row.resultado;
}
