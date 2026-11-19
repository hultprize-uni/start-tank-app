import type { Decision } from "@/shared/domain/types";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { classifyRounds, accumulatedOf, priceOf, sortRounds, type RoundRow, type RoundVoteRow } from "@/server/db/rounds";
import { toNumber } from "@/server/db/values";
import { OPERATOR_ACTION_LABELS } from "../labels";
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
  RoundSummaryView,
  StandingView,
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
  second: "2-digit",
  hour12: false,
  timeZone: EVENT_TIME_ZONE,
});

/** Ronda que controla el operador: la activa, o la siguiente programada, o la última terminada. */
export function operatorReferenceRound(rounds: readonly RoundRow[]): RoundRow | undefined {
  const c = classifyRounds(rounds);
  return c.active ?? c.pending ?? c.lastFinished ?? sortRounds(rounds)[0];
}

/** Texto del motivo de bloqueo del veredicto según los votos que faltan. */
function revealBlockedText(pendingCount: number): string {
  return pendingCount === 1 ? "Bloqueado: falta 1 voto" : `Bloqueado: faltan ${pendingCount} votos`;
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
      ? revealBlockedText(pendingCount)
      : "Requiere votación habilitada.";

  const row = (
    id: OperatorActionId,
    done: boolean,
    enabled: boolean,
    blockedReason: string | null,
  ): OperatorActionView => ({ id, label: ACTION_VIEW_LABELS[id], done, enabled, blockedReason });

  return [
    row("open", state !== "SCHEDULED", state === "SCHEDULED", null),
    row(
      "last_call",
      ["LAST_CALL", "CLOSED", "VOTING", "SETTLED"].includes(state),
      state === "OPEN",
      state === "OPEN" ? null : "Requiere la ronda abierta.",
    ),
    row(
      "close",
      ["CLOSED", "VOTING", "SETTLED"].includes(state),
      state === "OPEN" || state === "LAST_CALL",
      state === "OPEN" || state === "LAST_CALL" ? null : "Requiere el mercado abierto.",
    ),
    row("reveal", state === "SETTLED", revealEnabled, revealReason),
    // La acción siguiente no tiene operación propia en la base de datos: avanzar de ronda
    // ocurre al abrir la siguiente ronda. Se muestra deshabilitada para conservar el contrato.
    row(
      "next",
      false,
      false,
      hasFinishedRound ? "Avanza al abrir la siguiente ronda." : null,
    ),
  ];
}

/** Etiquetas visibles de las acciones del operador, en el orden de la consola. */
const ACTION_VIEW_LABELS: Readonly<Record<OperatorActionId, string>> = {
  open: "Abrir mercado",
  last_call: "Declarar última llamada",
  close: "Cerrar mercado",
  reveal: "Revelar veredicto",
  next: "Siguiente startup",
};

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

/** Segundos restantes de la última llamada. Es null fuera de esa fase. */
function lastCallRemainingOf(row: RoundRow): number | null {
  if (row.estado !== "LAST_CALL" || row.segundos_ultima_llamada === null) return null;
  return Math.max(0, EVENT_CONFIG.lastCallSeconds - Math.floor(row.segundos_ultima_llamada));
}

/** Multiplicador liquidado de una ronda, o null mientras no esté liquidada. */
function settledMultiplierOf(row: RoundRow): number | null {
  if (row.estado !== "SETTLED" || row.multiplicador === null) return null;
  return toNumber(row.multiplicador);
}

/** Lista de rondas del evento para la barra lateral. */
function buildRoundSummaries(rounds: readonly RoundRow[]): RoundSummaryView[] {
  return sortRounds(rounds).map((row) => ({
    number: row.numero,
    startupName: row.startup_nombre,
    status: row.estado,
    multiplier: settledMultiplierOf(row),
  }));
}

/**
 * Puntajes de las startups liquidadas. Se ordenan de mayor a menor puntaje y, ante empate, por
 * mayor fracción de respaldo, como indica el criterio de desempate del dominio.
 */
export function buildStandings(rounds: readonly RoundRow[]): StandingView[] {
  return sortRounds(rounds)
    .filter((row) => row.estado === "SETTLED" && row.puntaje !== null)
    .map(
      (row): StandingView => ({
        roundNumber: row.numero,
        startupName: row.startup_nombre,
        score: toNumber(row.puntaje),
        fraction: row.fraccion_respaldo === null ? null : toNumber(row.fraccion_respaldo),
      }),
    )
    .sort((a, b) => b.score - a.score || (b.fraction ?? 0) - (a.fraction ?? 0));
}

/**
 * Construye el view model de la consola del operador. Devuelve nulo cuando no existen rondas.
 * El sentido de los votos se revela solo cuando la ronda está SETTLED.
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
    roundNumber: action.numero,
    label: OPERATOR_ACTION_LABELS[action.accion] ?? action.accion,
    operator: action.operador,
  }));

  return {
    round: {
      number: current.numero,
      total: data.rounds.length,
      startupName: current.startup_nombre,
      status: state,
      multiplier: settledMultiplierOf(current),
      cancelMode: cancelModeOf(data.cancelAction),
    },
    rounds: buildRoundSummaries(data.rounds),
    actions: buildActions(state, cast, totalVotes, c.lastFinished !== undefined),
    jurors,
    market: {
      accumulated: accumulatedOf(current),
      uniqueInvestors: current.inversores_unicos ?? 0,
      // La base de datos no registra sesiones activas; se usa el número de asistentes activos.
      connectedAttendees: data.activeUsers,
      price: priceOf(current),
      lastCallRemaining: lastCallRemainingOf(current),
    },
    standings: buildStandings(data.rounds),
    log,
    canUndo: false,
    // La anulación se ofrece solo con la ronda cerrada o en votación, según el prototipo.
    canCancel: ["CLOSED", "VOTING"].includes(state),
    canManualSettle: false,
    manualMode: { enabled: false, backs: 0 },
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
