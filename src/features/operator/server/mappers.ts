import type { EventConfig } from "@/shared/domain/config";
import { priceOf, accumulatedOf, type RoundRow } from "@/server/db/rounds";
import { toNumber } from "@/server/db/values";
import type { EventFlags } from "@/server/db/config";
import type {
  AttendeeView,
  BalanceRow,
  CancelMode,
  OperatorRole,
  OperatorViewModel,
  PhaseDurations,
  PositionRow,
} from "../types";
import {
  buildOperatorView,
  type OperatorSnapshot,
  type SnapshotAction,
  type SnapshotJuror,
  type SnapshotRound,
} from "../view";

/*
 * Mapeos puros de las filas de la base al snapshot de la consola. No acceden a la base: los usa
 * queries.ts y se prueban con filas de ejemplo.
 */

/** Saldo actual de un asistente. */
export interface BalanceSnapshotRow {
  id_usuario: string;
  nombre: string;
  saldo_actual: string;
}

/** Posición de un asistente en una ronda: suma de sus inversiones y su retorno, si ya está liquidado. */
export interface AttendeePositionRow {
  id_usuario: string;
  nombre: string;
  numero: number;
  startup_nombre: string;
  monto: string;
  retorno: string | null;
}

/** Acción registrada por un operador sobre una ronda. */
export interface ActionRow {
  id_accion: string;
  accion: string;
  ejecutada_en: Date | string;
  operador: string;
  numero: number;
  motivo: string | null;
}

/** Envío y conexión de un jurado en la ronda de referencia. Nunca incluye las notas por criterio. */
export interface JurorRow {
  id: string;
  name: string;
  sent: boolean;
  abstains: boolean;
  drafting: boolean;
  /** Puntaje del envío. La consulta solo lo trae con la ronda liquidada. */
  score: string | null;
  seconds_since_seen: number | null;
}

/** Operador de la sesión. */
export interface OperatorRow {
  nombre: string;
  rol: string;
}

/** Asistente con su posición por patrimonio, como lo devuelve la búsqueda. */
export interface AttendeeRow {
  id: string;
  name: string | null;
  email: string | null;
  balance: string;
  position: number;
  seconds_since_seen: number | null;
  last_round: number | null;
  last_startup: string | null;
  last_amount: string | null;
}

export interface OperatorData {
  operator: OperatorRow;
  config: EventConfig;
  flags: EventFlags;
  rounds: readonly RoundRow[];
  firstOpenAt: string | null;
  jurors: readonly JurorRow[];
  cancelAction: string | null;
  attendeesOnline: number;
  attendeesTotal: number;
  actions: readonly ActionRow[];
  balances: readonly BalanceSnapshotRow[];
  positions: readonly AttendeePositionRow[];
  now: Date;
}

/** Rol de la base (CONDUCTOR, SOPORTE) en el valor del dominio. Cualquier otro valor solo lee. */
export function toOperatorRole(dbRole: string): OperatorRole {
  return dbRole === "CONDUCTOR" ? "CONDUCTOR" : "SUPPORT";
}

/** Modo de anulación derivado de la acción registrada para la ronda. */
export function cancelModeOf(action: string | null): CancelMode | null {
  if (action === "CANCEL_REFUND") return "refund";
  if (action === "CANCEL_SETTLE_1X") return "settle_1x";
  return null;
}

export function durationsOf(config: EventConfig): PhaseDurations {
  return {
    pitch: config.pitchSeconds,
    qa: config.qaSeconds,
    lastCall: config.lastCallSeconds,
    voting: config.votingSeconds,
    result: config.resultSeconds,
  };
}

export function toSnapshotRound(row: RoundRow): SnapshotRound {
  return {
    number: row.numero,
    startupName: row.startup_nombre,
    sdg: row.ods,
    status: row.estado,
    multiplier: row.multiplicador === null ? null : toNumber(row.multiplicador),
    juryScore: row.puntaje_jurado === null ? null : toNumber(row.puntaje_jurado),
    phaseEndsAt: row.fase_termina_en,
    pausedSeconds: row.segundos_restantes_pausa,
    accumulated: accumulatedOf(row),
    uniqueInvestors: row.inversores_unicos ?? 0,
    price: priceOf(row),
  };
}

export function toSnapshotJuror(row: JurorRow): SnapshotJuror {
  return {
    id: row.id,
    name: row.name,
    sent: row.sent,
    abstains: row.abstains,
    drafting: row.drafting,
    score: row.score === null ? null : toNumber(row.score),
    secondsSinceSeen: row.seconds_since_seen,
  };
}

export function toSnapshotAction(row: ActionRow): SnapshotAction {
  return {
    id: row.id_accion,
    at: row.ejecutada_en instanceof Date ? row.ejecutada_en : new Date(row.ejecutada_en),
    roundNumber: row.numero,
    action: row.accion,
    operator: row.operador,
    reason: row.motivo,
  };
}

export function toBalanceRow(row: BalanceSnapshotRow): BalanceRow {
  return {
    attendeeId: row.id_usuario,
    attendeeName: row.nombre,
    balance: toNumber(row.saldo_actual),
  };
}

export function toPositionRow(row: AttendeePositionRow): PositionRow {
  return {
    attendeeId: row.id_usuario,
    attendeeName: row.nombre,
    round: row.numero,
    startupName: row.startup_nombre,
    amount: toNumber(row.monto),
    returnAmount: row.retorno === null ? null : toNumber(row.retorno),
  };
}

export function toAttendeeView(row: AttendeeRow, onlineSeconds: number): AttendeeView {
  return {
    id: row.id,
    name: row.name ?? `Asistente ${row.id}`,
    email: row.email,
    balance: toNumber(row.balance),
    position: row.position,
    online: row.seconds_since_seen !== null && row.seconds_since_seen < onlineSeconds,
    lastSeenSeconds: row.seconds_since_seen === null ? null : Math.floor(row.seconds_since_seen),
    lastInvestment:
      row.last_round === null || row.last_startup === null
        ? null
        : {
            roundNumber: row.last_round,
            startupName: row.last_startup,
            amount: toNumber(row.last_amount),
          },
  };
}

/** Convierte las filas leídas en el snapshot de la consola. */
export function toOperatorSnapshot(data: OperatorData): OperatorSnapshot {
  return {
    now: data.now,
    operator: { name: data.operator.nombre, role: toOperatorRole(data.operator.rol) },
    flags: data.flags,
    durations: durationsOf(data.config),
    rounds: data.rounds.map(toSnapshotRound),
    firstOpenAt: data.firstOpenAt,
    jurors: data.jurors.map(toSnapshotJuror),
    cancelMode: cancelModeOf(data.cancelAction),
    attendeesOnline: data.attendeesOnline,
    attendeesTotal: data.attendeesTotal,
    actions: data.actions.map(toSnapshotAction),
    balances: data.balances.map(toBalanceRow),
    positions: data.positions.map(toPositionRow),
  };
}

/** Arma el view model de la consola desde las filas. Devuelve null sin rondas. */
export function buildOperatorViewFromRows(data: OperatorData): OperatorViewModel | null {
  return buildOperatorView(toOperatorSnapshot(data));
}
