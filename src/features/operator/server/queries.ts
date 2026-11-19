import { sql } from "@/server/db/client";
import {
  classifyRounds,
  queryActiveUsers,
  queryRoundVotes,
  queryRounds,
} from "@/server/db/rounds";
import type { StaffMember } from "@/server/db/staff";
import {
  normalizeFunctionResult,
  toActionName,
  toDbAction,
  type FunctionResult,
} from "@/server/db/values";
import {
  buildOperatorView,
  operatorReferenceRound,
  type ActionRow,
  type AttendeePositionRow,
  type BalanceSnapshotRow,
} from "./mappers";
import type { OperatorViewModel } from "../types";

/*
 * Consultas de la consola del operador. Las lecturas delegan el armado del view model en
 * mappers.ts; las escrituras se realizan solo mediante las funciones SQL transaccionales de la
 * base de datos.
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

/** Límite de acciones mostradas en el registro del operador. */
const ACTION_LIMIT = 50;

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
  return row === undefined ? null : toActionName(row.accion);
}

/** Acciones recientes del operador, de la más nueva a la más antigua. */
async function queryActions(): Promise<ActionRow[]> {
  const rows = await sql<ActionRow>`
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
  return rows.map((row) => ({ ...row, accion: toActionName(row.accion) }));
}

/** Busca un operador por su código de acceso. */
export async function findOperatorByCode(code: string): Promise<StaffMember | null> {
  const [row] = await sql<StaffMember>`
    select id_operador::text as id, nombre
      from operador
     where codigo_acceso = ${code}
     limit 1`;
  return row ?? null;
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
 * Ejecuta una acción del operador sobre la ronda que le corresponde. ABRIR actúa sobre la siguiente
 * ronda programada y el resto sobre la ronda activa. REVELAR llama a fn_revelar_veredicto y las
 * demás acciones a fn_accion_operador.
 */
export async function executeOperatorAction(
  operatorId: string,
  action: ApiOperatorAction,
): Promise<FunctionResult> {
  const rounds = await queryRounds();
  const c = classifyRounds(rounds);
  const round = action === "OPEN" ? c.pending : c.active;
  if (round === undefined) {
    return { ok: false, error: "ROUND_UNAVAILABLE" };
  }

  if (action === "REVEAL") {
    const [row] = await sql<{ resultado: Record<string, unknown> }>`
      select fn_revelar_veredicto(${operatorId}::bigint, ${round.id_ronda}::bigint) as resultado`;
    return normalizeFunctionResult(row.resultado);
  }

  const [row] = await sql<{ resultado: Record<string, unknown> }>`
    select fn_accion_operador(${operatorId}::bigint, ${round.id_ronda}::bigint, ${toDbAction(action)}::varchar) as resultado`;
  return normalizeFunctionResult(row.resultado);
}
