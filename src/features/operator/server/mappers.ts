import type { Decision } from "@/shared/domain/types";
import { classifyRounds, accumulatedOf, priceOf, sortRounds, type RoundRow, type RoundVoteRow } from "@/server/db/rounds";
import { toNumber } from "@/server/db/values";
import type {
  BalanceRow,
  CancelMode,
  JurorSense,
  JurorVoteView,
  LogEntryView,
  OperatorActionId,
  OperatorActionView,
  OperatorViewModel,
  PositionRow,
  RoundStatus,
} from "../types";

/*
 * Constructor puro del view model de la consola del operador. Recibe las filas que devuelven las
 * consultas de queries.ts y no accede a la base de datos.
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
  ejecutada_en: Date;
  operador: string;
  numero: number;
  startup_nombre: string;
}

export interface OperatorData {
  rounds: readonly RoundRow[];
  /** Votos de la ronda que controla el operador. */
  votes: readonly RoundVoteRow[];
  /** Acción de anulación registrada para la ronda que controla el operador, si existe. */
  cancelAction: string | null;
  activeUsers: number;
  balances: readonly BalanceSnapshotRow[];
  positions: readonly AttendeePositionRow[];
  actions: readonly ActionRow[];
  /** Fecha de referencia para el registro de acciones y la cuenta regresiva. */
  now: Date;
}

/** Zona horaria del evento para el registro de acciones del operador. */
const EVENT_TIME_ZONE = "America/Lima";

const TIME_FORMAT = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: EVENT_TIME_ZONE,
});

/** Etiquetas visibles de las acciones registradas en accion_ronda. */
const ACTION_LABELS: Readonly<Record<string, string>> = {
  OPEN: "Abrir mercado",
  LAST_CALL: "Declarar última llamada",
  CLOSE: "Cerrar mercado",
  ENABLE_VOTING: "Habilitar votación",
  REVEAL: "Revelar veredicto",
  CANCEL_REFUND: "Anular y devolver",
  CANCEL_SETTLE_1X: "Anular y liquidar a 1.0x",
};

/** Ronda que controla el operador: la activa, o la siguiente programada, o la última terminada. */
export function operatorReferenceRound(rounds: readonly RoundRow[]): RoundRow | undefined {
  const c = classifyRounds(rounds);
  return c.active ?? c.pending ?? c.lastFinished ?? sortRounds(rounds)[0];
}

/** Acciones que el operador puede disparar en cada estado de la ronda que controla. */
function buildActions(
  state: RoundStatus,
  votesCast: number,
  totalVotes: number,
  hasFinishedRound: boolean,
): OperatorActionView[] {
  const pendingCount = Math.max(0, totalVotes - votesCast);
  const revealEnabled = state === "VOTING" && pendingCount === 0 && totalVotes > 0;

  const revealReason = revealEnabled
    ? null
    : state === "VOTING"
      ? `Faltan ${pendingCount} voto(s)`
      : "Requiere votación habilitada.";

  const row = (
    id: OperatorActionId,
    label: string,
    done: boolean,
    enabled: boolean,
    blockedReason: string | null,
  ): OperatorActionView => ({ id, label, done, enabled, blockedReason });

  return [
    row("open", "Abrir mercado", state !== "SCHEDULED", state === "SCHEDULED", null),
    row(
      "last_call",
      "Última llamada",
      ["LAST_CALL", "CLOSED", "VOTING", "SETTLED"].includes(state),
      state === "OPEN",
      state === "OPEN" ? null : "Requiere la ronda abierta.",
    ),
    row(
      "close",
      "Cerrar mercado",
      ["CLOSED", "VOTING", "SETTLED"].includes(state),
      state === "OPEN" || state === "LAST_CALL",
      state === "OPEN" || state === "LAST_CALL" ? null : "Requiere el mercado abierto.",
    ),
    row("reveal", "Revelar veredicto", state === "SETTLED", revealEnabled, revealReason),
    // La acción siguiente no tiene operación propia en la base de datos: avanzar de ronda
    // ocurre al abrir la siguiente ronda. Se muestra deshabilitada para conservar el contrato.
    row(
      "next",
      "Siguiente startup",
      false,
      false,
      hasFinishedRound ? "Avanza al abrir la siguiente ronda." : null,
    ),
  ];
}

function senseOf(decision: Decision | null, state: RoundStatus): JurorSense | null {
  if (state !== "SETTLED" || decision === null) return null;
  const senseMap: Readonly<Record<Decision, JurorSense>> = {
    BACK: "backs",
    REJECT: "rejects",
    ABSTAIN: "abstains",
  };
  return senseMap[decision];
}

function timeOf(date: Date): string {
  return TIME_FORMAT.format(date);
}

/** Modo de anulación derivado de la acción registrada para la ronda. */
function cancelModeOf(action: string | null): CancelMode | null {
  if (action === "CANCEL_REFUND") return "refund";
  if (action === "CANCEL_SETTLE_1X") return "settle_1x";
  return null;
}

/**
 * Construye el view model de la consola del operador. Devuelve nulo cuando no existen rondas.
 * El sentido de los votos se revela solo cuando la ronda está LIQUIDADA.
 */
export function buildOperatorView(data: OperatorData): OperatorViewModel | null {
  const current = operatorReferenceRound(data.rounds);
  if (current === undefined) return null;

  const state = current.estado as RoundStatus;
  const c = classifyRounds(data.rounds);
  const cast = data.votes.filter((v) => v.decision !== null).length;
  const totalVotes = data.votes.length;

  const jurors: JurorVoteView[] = data.votes.map((vote) => ({
    id: `jurado-${vote.id_jurado}`,
    label: vote.nombre,
    emitted: vote.decision !== null,
    sense: senseOf(vote.decision, state),
  }));

  const log: LogEntryView[] = data.actions.map((action) => ({
    id: action.id_accion,
    time: timeOf(action.ejecutada_en),
    label: ACTION_LABELS[action.accion] ?? action.accion,
    operator: action.operador,
    detail: `Ronda ${action.numero}: ${action.startup_nombre}`,
  }));

  return {
    round: {
      number: current.numero,
      total: data.rounds.length,
      startupName: current.startup_nombre,
      status: state,
      multiplier: current.multiplicador === null ? null : toNumber(current.multiplicador),
      result: null,
      cancelMode: cancelModeOf(data.cancelAction),
    },
    screenSynced: true,
    actions: buildActions(state, cast, totalVotes, c.lastFinished !== undefined),
    jurors: jurors,
    market: {
      accumulated: accumulatedOf(current),
      uniqueInvestors: current.inversores_unicos ?? 0,
      // La base de datos no registra sesiones activas; se usa el número de asistentes activos.
      connectedAttendees: data.activeUsers,
      price: priceOf(current),
    },
    log,
    canUndo: false,
    canCancel: ["OPEN", "LAST_CALL", "CLOSED", "VOTING"].includes(state),
    canManualSettle: false,
    balances: data.balances.map(
      (row): BalanceRow => ({
        attendeeId: row.id_usuario,
        attendeeName: row.nombre,
        balance: toNumber(row.saldo_actual),
      }),
    ),
    positions: data.positions.map(
      (row): PositionRow => ({
        attendeeId: row.id_usuario,
        attendeeName: row.nombre,
        round: row.numero,
        startupName: row.startup_nombre,
        amount: toNumber(row.monto),
        returnAmount: row.retorno === null ? null : toNumber(row.retorno),
      }),
    ),
  };
}
