import { sql } from "@/server/db/client";
import { readEventConfig } from "@/server/db/config";
import { classifyRounds, queryRounds, type RoundRow } from "@/server/db/rounds";
import type { StaffMember } from "@/server/db/staff";
import {
  normalizeFunctionResult,
  toActionName,
  toDbAction,
  type FunctionResult,
} from "@/server/db/values";
import type { OperatorAction } from "@/shared/domain/types";
import { ATTENDEE_ONLINE_SECONDS } from "../thresholds";
import type { OperatorViewModel } from "../types";
import { referenceRound } from "../view";
import {
  buildOperatorViewFromRows,
  toOperatorRole,
  type ActionRow,
  type AttendeePositionRow,
  type BalanceSnapshotRow,
  type JurorRow,
  type OperatorRow,
} from "./mappers";

/*
 * Consultas de la consola del operador. Las lecturas delegan el armado del view model en
 * mappers.ts y view.ts; las escrituras de ronda pasan solo por las funciones SQL transaccionales.
 */

/** Acciones de ronda que la API acepta (RF-06 a RF-10, RF-18). */
export const API_OPERATOR_ACTIONS = [
  "OPEN",
  "LAST_CALL",
  "CLOSE",
  "ENABLE_VOTING",
  "PAUSE",
  "RESUME",
  "ADD_MINUTE",
  "REVEAL",
  "CANCEL_REFUND",
  "CANCEL_SETTLE_1X",
] as const;

export type ApiOperatorAction = (typeof API_OPERATOR_ACTIONS)[number];

/** Acciones que exigen motivo: las anulaciones (RF-10). El rescate lo exige al revelar sin los 4. */
export const ACTIONS_WITH_REASON: ReadonlySet<ApiOperatorAction> = new Set<ApiOperatorAction>([
  "CANCEL_REFUND",
  "CANCEL_SETTLE_1X",
]);

/** Límite de acciones mostradas en el log del operador. */
const ACTION_LIMIT = 200;

/** Busca un operador por su código de acceso. */
export async function findOperatorByCode(code: string): Promise<StaffMember | null> {
  const [row] = await sql<StaffMember>`
    select id_operador::text as id, nombre
      from operador
     where codigo_acceso = ${code}
     limit 1`;
  return row ?? null;
}

/** Nombre y rol del operador de la sesión. Null si ya no existe. */
export async function queryOperator(operatorId: string): Promise<OperatorRow | null> {
  const [row] = await sql<OperatorRow>`
    select nombre, rol from operador where id_operador = ${operatorId}::bigint`;
  return row ?? null;
}

/** Indica si el operador tiene el rol de conductor (RF-05). */
export async function isConductor(operatorId: string): Promise<boolean> {
  const row = await queryOperator(operatorId);
  return row !== null && toOperatorRole(row.rol) === "CONDUCTOR";
}

/** Saldos actuales de todos los asistentes, para la exportación. */
async function queryBalances(): Promise<BalanceSnapshotRow[]> {
  return sql<BalanceSnapshotRow>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           u.saldo_actual::text as saldo_actual
      from usuario u
     order by u.saldo_actual desc, u.id_usuario`;
}

/** Posiciones por asistente y ronda, para la exportación. */
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

/** Última anulación registrada para una ronda, si existe. */
async function queryCancelAction(roundId: string): Promise<string | null> {
  const [row] = await sql<{ accion: string }>`
    select a.accion
      from accion_ronda a
     where a.id_ronda = ${roundId}::bigint
       and a.accion in ('ANULAR_DEVOLVER', 'ANULAR_LIQUIDAR_1X')
     order by a.id_accion desc
     limit 1`;
  return row === undefined ? null : toActionName(row.accion);
}

/** Acciones recientes de los operadores, con su motivo, de la más nueva a la más antigua (RF-09). */
async function queryActions(): Promise<ActionRow[]> {
  const rows = await sql<ActionRow>`
    select a.id_accion::text as id_accion,
           a.accion,
           a.ejecutada_en,
           o.nombre as operador,
           r.numero,
           a.motivo
      from accion_ronda a
      join operador o on o.id_operador = a.id_operador
      join ronda r on r.id_ronda = a.id_ronda
     order by a.id_accion desc
     limit ${ACTION_LIMIT}`;
  return rows.map((row) => ({ ...row, accion: toActionName(row.accion) }));
}

/**
 * Envíos de los jurados en una ronda, su borrador y su última conexión. El puntaje solo se lee con
 * la ronda liquidada; antes viaja nulo (RF-17, RNF-11).
 */
export async function queryJurors(roundId: string, settled: boolean): Promise<JurorRow[]> {
  return sql<JurorRow>`
    select j.id_jurado::text as id,
           j.nombre as name,
           (v.id_veredicto is not null) as sent,
           coalesce(v.se_abstiene, false) as abstains,
           exists (
             select 1 from borrador_nota b
              where b.id_jurado = j.id_jurado and b.id_ronda = ${roundId}::bigint
           ) as drafting,
           case when ${settled}::boolean then v.puntaje::text end as score,
           extract(epoch from (now() - j.ultima_conexion))::float8 as seconds_since_seen
      from jurado j
      left join veredicto v
        on v.id_jurado = j.id_jurado
       and v.id_ronda = ${roundId}::bigint
     order by j.id_jurado`;
}

/** Asistentes conectados en los últimos 30 segundos y billeteras registradas. */
export async function queryAttendeeCounts(): Promise<{ online: number; total: number }> {
  const [row] = await sql<{ online: number; total: number }>`
    select count(*) filter (
             where ultima_conexion > now() - make_interval(secs => ${ATTENDEE_ONLINE_SECONDS})
           )::int as online,
           count(*)::int as total
      from usuario`;
  return { online: row?.online ?? 0, total: row?.total ?? 0 };
}

/** Hora ISO de la apertura de la primera ronda: el inicio real del evento. */
async function queryFirstOpen(): Promise<string | null> {
  const [row] = await sql<{ first_open: string | null }>`
    select to_char(min(abierta_en) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as first_open
      from ronda`;
  return row?.first_open ?? null;
}

/** Ronda de referencia del operador entre las filas leídas. */
function referenceRow(rounds: readonly RoundRow[]): RoundRow | undefined {
  const reference = referenceRound(rounds.map((row) => ({ number: row.numero, status: row.estado })));
  return reference === undefined ? undefined : rounds.find((row) => row.numero === reference.number);
}

/** Lee el view model de la consola para el operador de la sesión. Null sin rondas o sin operador. */
export async function readOperatorView(
  operatorId: string,
  now: Date = new Date(),
): Promise<OperatorViewModel | null> {
  const [operator, rounds, { config, flags }] = await Promise.all([
    queryOperator(operatorId),
    queryRounds(),
    readEventConfig(),
  ]);
  if (operator === null) return null;
  const current = referenceRow(rounds);
  if (current === undefined) return null;

  const [jurors, cancelAction, counts, firstOpenAt, actions, balances, positions] =
    await Promise.all([
      queryJurors(current.id_ronda, current.estado === "SETTLED"),
      queryCancelAction(current.id_ronda),
      queryAttendeeCounts(),
      queryFirstOpen(),
      queryActions(),
      queryBalances(),
      queryPositions(),
    ]);

  return buildOperatorViewFromRows({
    operator,
    config,
    flags,
    rounds,
    firstOpenAt,
    jurors,
    cancelAction,
    attendeesOnline: counts.online,
    attendeesTotal: counts.total,
    actions,
    balances,
    positions,
    now,
  });
}

/** Lee los datos de la exportación CSV: saldos y posiciones de los asistentes (RF-31). */
export async function readExportRows(): Promise<{
  balances: BalanceSnapshotRow[];
  positions: AttendeePositionRow[];
}> {
  const [balances, positions] = await Promise.all([queryBalances(), queryPositions()]);
  return { balances, positions };
}

/** Resultado de una acción de ronda, con el multiplicador cuando se revela. */
export interface ActionResult extends FunctionResult {
  multiplier?: number;
}

/**
 * Ejecuta una acción del operador sobre la ronda que le corresponde. OPEN actúa sobre la siguiente
 * ronda programada y el resto sobre la ronda en curso. REVEAL llama a fn_revelar_veredicto: con
 * motivo revela con los jurados presentes (RF-18). Las demás acciones van a fn_accion_operador,
 * que valida el rol, la transición y el motivo de las anulaciones.
 */
export async function executeOperatorAction(
  operatorId: string,
  action: ApiOperatorAction,
  reason: string | null = null,
): Promise<ActionResult> {
  const rounds = await queryRounds();
  const c = classifyRounds(rounds);
  const round = action === "OPEN" ? c.pending : c.active;
  if (round === undefined) {
    return { ok: false, error: "ROUND_UNAVAILABLE" };
  }

  if (action === "REVEAL") {
    const rescue = reason !== null;
    const [row] = await sql<{ resultado: Record<string, unknown> }>`
      select fn_revelar_veredicto(${operatorId}::bigint, ${round.id_ronda}::bigint,
                                  ${rescue}::boolean, ${reason}::varchar) as resultado`;
    const result: ActionResult = normalizeFunctionResult(row.resultado);
    if (typeof row.resultado.multiplicador === "number" || typeof row.resultado.multiplicador === "string") {
      result.multiplier = Number(row.resultado.multiplicador);
    }
    return result;
  }

  const [row] = await sql<{ resultado: Record<string, unknown> }>`
    select fn_accion_operador(${operatorId}::bigint, ${round.id_ronda}::bigint,
                              ${toDbAction(action as OperatorAction)}::varchar,
                              ${reason}::varchar) as resultado`;
  return normalizeFunctionResult(row.resultado);
}

/**
 * Liquida la ronda en curso a mano con el puntaje contado por el conductor (1 a 5) y un motivo.
 * Devuelve el jsonb de fn_liquidar_manual sin traducir.
 */
export async function executeManualSettlement(
  operatorId: string,
  score: number,
  reason: string,
): Promise<Record<string, unknown>> {
  const rounds = await queryRounds();
  const c = classifyRounds(rounds);
  if (c.active === undefined) {
    return { ok: false, error: "RONDA_NO_DISPONIBLE" };
  }

  const [row] = await sql<{ resultado: Record<string, unknown> }>`
    select fn_liquidar_manual(${operatorId}::bigint, ${c.active.id_ronda}::bigint,
                              ${score}::numeric, ${reason}::varchar) as resultado`;
  return row.resultado;
}

/**
 * Registra en accion_ronda una acción de administración (modo manual, configuración, inicio del
 * evento) para que quede en el log con el operador, la hora y el motivo (RF-09). accion_ronda
 * siempre referencia una ronda: se usa la misma regla que fn_ajustar_saldo (la ronda en curso, si
 * no la última iniciada, si no la primera). Sin rondas no se registra nada.
 */
export async function logAdminAction(
  operatorId: string,
  action: string,
  reason: string | null,
): Promise<void> {
  await sql`
    insert into accion_ronda (id_operador, id_ronda, accion, motivo)
    select ${operatorId}::bigint, r.id_ronda, ${action}, ${reason}
      from ronda r
     order by (r.estado in ('ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION')) desc,
              (r.estado <> 'PROGRAMADA') desc,
              case when r.estado <> 'PROGRAMADA' then -r.numero else r.numero end
     limit 1`;
}

/** Indica si hay una ronda en curso: bloquea la configuración (RF-28). */
export async function hasActiveRound(): Promise<boolean> {
  const [row] = await sql<{ active: boolean }>`
    select exists (
      select 1 from ronda where estado in ('ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION')
    ) as active`;
  return row?.active === true;
}
