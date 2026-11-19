import { EVENT_CONFIG } from "@/shared/domain/config";
import { pickWinner, startupScore, type StartupStanding } from "@/shared/domain/scoring";
import { calcVerdict } from "@/shared/domain/verdict";
import type { Decision, RoundState } from "@/shared/domain/types";
import type { JuryCriterion, JuryScreen, JuryViewModel } from "@/lib/api/jury.types";
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
} from "@/lib/api/operator.types";
import type {
  BetweenRounds,
  ScreenInvestorRow,
  ScreenStartupRow,
  Closing,
  Settlement,
  SdgRef,
  RoundRef,
  ScreenViewModel,
  RevealedVote,
} from "@/features/screen/types";

/*
 * Constructores puros de los view models de pantalla, jurado y operador. Reciben las filas que
 * devuelven las consultas de queries.ts y no acceden a la base de datos, de modo que el mapeo
 * se prueba sin conexión.
 */

/** Filas crudas. Los valores numeric y bigint de Postgres llegan como cadenas y se convierten aquí. */

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

/** Voto de un jurado en una ronda. Decision es nula cuando el jurado aún no ha votado. */
export interface RoundVoteRow {
  id_jurado: string;
  nombre: string;
  decision: Decision | null;
}

/** Fila del leaderboard de asistentes de una ronda. */
export interface RankingRow {
  id_usuario: string;
  nombre: string;
  posicion: number;
  saldo: string;
  aciertos: number;
}

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

export interface ScreenData {
  rounds: readonly RoundRow[];
  /** Votos de la ronda de referencia de la pantalla (activa, o la última terminada). */
  votes: readonly RoundVoteRow[];
  /** Leaderboard de la última ronda terminada. */
  ranking: readonly RankingRow[];
  activeUsers: number;
}

export interface JuryData {
  jurorId: string;
  name: string;
  rounds: readonly RoundRow[];
  /** Votos de la ronda activa. Vacío cuando no hay ronda activa. */
  votes: readonly RoundVoteRow[];
  totalJurors: number;
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

/** Nombres oficiales de los Objetivos de Desarrollo Sostenible, indexados por número. */
const SDG_NAMES: Readonly<Record<number, string>> = {
  1: "Fin de la pobreza",
  2: "Hambre cero",
  3: "Salud y bienestar",
  4: "Educación de calidad",
  5: "Igualdad de género",
  6: "Agua limpia y saneamiento",
  7: "Energía asequible y no contaminante",
  8: "Trabajo decente y crecimiento económico",
  9: "Industria, innovación e infraestructura",
  10: "Reducción de las desigualdades",
  11: "Ciudades y comunidades sostenibles",
  12: "Producción y consumo responsables",
  13: "Acción por el clima",
  14: "Vida submarina",
  15: "Vida de ecosistemas terrestres",
  16: "Paz, justicia e instituciones sólidas",
  17: "Alianzas para lograr los objetivos",
};

/** Criterios de evaluación que el portal del jurado recuerda en cada ronda. */
export const JURY_CRITERIA: readonly JuryCriterion[] = [
  { id: "viability", label: "Viabilidad" },
  { id: "sdg_impact", label: "Impacto ODS" },
];

/** Estados en los que una ronda ocupa el turno de la sala. Solo puede existir una a la vez. */
const ACTIVE_STATES: ReadonlySet<RoundState> = new Set<RoundState>([
  "OPEN",
  "LAST_CALL",
  "CLOSED",
  "VOTING",
]);

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

/** Convierte un valor numérico de la base de datos. Los nulos equivalen a cero. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

/** Obtiene el número y el nombre del ODS a partir de su texto de base de datos, por ejemplo "ODS 6". */
export function parseSdg(text: string | null): SdgRef {
  const matched = text?.match(/\d+/);
  const number = matched ? Number(matched[0]) : 0;
  return { number: number, name: SDG_NAMES[number] ?? "" };
}

/** Ordena las rondas por número ascendente sin modificar la lista original. */
function sortRounds(rounds: readonly RoundRow[]): RoundRow[] {
  return [...rounds].sort((a, b) => a.numero - b.numero);
}

export interface RoundClassification {
  /** Ronda en curso: ABIERTA, ULTIMA_LLAMADA, CERRADA o EN_VOTACION. */
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

/** Ronda que la pantalla proyecta: la activa, o la última terminada, o la siguiente programada. */
export function screenReferenceRound(rounds: readonly RoundRow[]): RoundRow | undefined {
  const c = classifyRounds(rounds);
  return c.active ?? c.lastFinished ?? c.pending ?? sortRounds(rounds)[0];
}

/** Ronda que controla el operador: la activa, o la siguiente programada, o la última terminada. */
export function operatorReferenceRound(rounds: readonly RoundRow[]): RoundRow | undefined {
  const c = classifyRounds(rounds);
  return c.active ?? c.pending ?? c.lastFinished ?? sortRounds(rounds)[0];
}

function toRoundRef(row: RoundRow): RoundRef {
  return {
    number: row.numero,
    startup: { name: row.startup_nombre, sdg: parseSdg(row.ods) },
  };
}

function priceOf(row: RoundRow): number {
  return row.precio_vivo === null ? EVENT_CONFIG.priceBase : toNumber(row.precio_vivo);
}

function accumulatedOf(row: RoundRow): number {
  return toNumber(row.monto_acumulado);
}

function secondsRemaining(row: RoundRow): number {
  if (row.segundos_ultima_llamada === null) return EVENT_CONFIG.lastCallSeconds;
  const elapsed = Math.floor(toNumber(row.segundos_ultima_llamada));
  return Math.max(0, EVENT_CONFIG.lastCallSeconds - elapsed);
}

/** Fila de inversionista a partir del leaderboard de la última ronda terminada. */
function toScreenInvestorRow(row: RankingRow): ScreenInvestorRow {
  return { position: row.posicion, name: row.nombre, balance: toNumber(row.saldo) };
}

/** Lista de startups ordenada por monto accumulated, con su precio vivo. */
function startupRows(rounds: readonly RoundRow[]): ScreenStartupRow[] {
  return sortRounds(rounds)
    .map((r) => ({ row: r, accumulated: accumulatedOf(r) }))
    .sort((a, b) => b.accumulated - a.accumulated || a.row.numero - b.row.numero)
    .map((item, index) => ({
      position: index + 1,
      name: item.row.startup_nombre,
      accumulated: item.accumulated,
      price: priceOf(item.row),
    }));
}

function toRevealedVotes(votes: readonly RoundVoteRow[]): RevealedVote[] {
  return votes
    .filter((v): v is RoundVoteRow & { decision: Decision } => v.decision !== null)
    .map((v) => ({ juror: v.nombre, decision: v.decision }));
}

function buildSettlement(
  last: RoundRow,
  votes: readonly RoundVoteRow[],
  updatedAt: string,
): Settlement {
  const revealedList = toRevealedVotes(votes);
  const backingFraction =
    last.fraccion_respaldo === null
      ? calcVerdict(revealedList.map((v) => v.decision)).fraction
      : toNumber(last.fraccion_respaldo);

  return {
    phase: "SETTLEMENT",
    updatedAt: updatedAt,
    round: toRoundRef(last),
    votes: revealedList,
    backingFraction: backingFraction,
    multiplier: toNumber(last.multiplicador ?? 1),
    amountInvested: toNumber(last.monto_invertido),
    roundReturn: toNumber(last.retorno_ronda),
  };
}

function buildBetweenRounds(
  data: ScreenData,
  closedRound: RoundRow,
  updatedAt: string,
): BetweenRounds {
  return {
    phase: "BETWEEN_ROUNDS",
    updatedAt: updatedAt,
    closedRound: toRoundRef(closedRound),
    investors: data.ranking.map(toScreenInvestorRow),
    startups: startupRows(data.rounds),
  };
}

/**
 * Construye el cierre con la startup ganadora, el top 3 y el asistente con mejor ojo.
 * Devuelve nulo cuando ninguna startup tiene puntaje calculado.
 */
function buildClosing(data: ScreenData, updatedAt: string): Closing | null {
  const candidatas = data.rounds
    .filter((r) => r.fraccion_respaldo !== null && r.puntaje !== null)
    .map((row) => {
      const standing: StartupStanding & { row: RoundRow } = {
        id: row.id_ronda,
        fraction: toNumber(row.fraccion_respaldo),
        investorPct:
          data.activeUsers > 0 ? (row.inversores_unicos ?? 0) / data.activeUsers : 0,
        row: row,
      };
      return standing;
    });

  const winner = pickWinner(candidatas);
  if (winner === undefined) return null;

  const best = [...data.ranking].sort(
    (a, b) => b.aciertos - a.aciertos || a.posicion - b.posicion,
  )[0];

  return {
    phase: "CLOSING",
    updatedAt: updatedAt,
    winner: {
      name: winner.row.startup_nombre,
      sdg: parseSdg(winner.row.ods),
      score: startupScore(winner.fraction, winner.investorPct),
      backingFraction: winner.fraction,
      investorPercentage: winner.investorPct,
    },
    top3: data.ranking.slice(0, 3).map(toScreenInvestorRow),
    bestEye: best
      ? { name: best.nombre, hits: best.aciertos }
      : { name: "", hits: 0 },
  };
}

/**
 * Construye el view model de la pantalla pública. Devuelve nulo cuando no existen rondas.
 * La fase se deduce del estado de la ronda activa o de la última ronda terminada.
 */
export function buildScreen(data: ScreenData, now: Date): ScreenViewModel | null {
  if (data.rounds.length === 0) return null;

  const updatedAt = now.toISOString();
  const c = classifyRounds(data.rounds);
  const active = c.active;

  if (active !== undefined) {
    const round = toRoundRef(active);
    if (active.estado === "OPEN") {
      return {
        phase: "MARKET",
        updatedAt: updatedAt,
        round: round,
        price: priceOf(active),
        accumulated: accumulatedOf(active),
        uniqueInvestors: active.inversores_unicos ?? 0,
      };
    }
    if (active.estado === "LAST_CALL") {
      return {
        phase: "LAST_CALL",
        updatedAt: updatedAt,
        round: round,
        price: priceOf(active),
        accumulated: accumulatedOf(active),
        uniqueInvestors: active.inversores_unicos ?? 0,
        secondsRemaining: secondsRemaining(active),
      };
    }
    return {
      phase: "VOTING",
      updatedAt: updatedAt,
      round: round,
      votesCast: data.votes.filter((v) => v.decision !== null).length,
      jurorsTotal: data.votes.length,
    };
  }

  const last = c.lastFinished;
  if (last !== undefined) {
    if (c.pending === undefined) {
      const closing = buildClosing(data, updatedAt);
      if (closing !== null) return closing;
    }
    if (last.estado === "SETTLED") {
      return buildSettlement(last, data.votes, updatedAt);
    }
  }

  const closedRound = last ?? c.pending ?? sortRounds(data.rounds)[0];
  return buildBetweenRounds(data, closedRound, updatedAt);
}

/**
 * Construye el view model del portal del jurado. La pantalla "votacion" se muestra solo cuando la
 * ronda está en EN_VOTACION y el jurado aún no ha votado en ella.
 */
export function buildJuryView(data: JuryData): JuryViewModel {
  const active = classifyRounds(data.rounds).active;
  const cast = data.votes.filter((v) => v.decision !== null).length;
  const own = data.votes.find((v) => v.id_jurado === data.jurorId);
  const voteRegistered = own !== undefined && own.decision !== null;

  let screen: JuryScreen = "waiting";
  if (active?.estado === "VOTING") {
    screen = voteRegistered ? "vote_registered" : "voting";
  }

  return {
    screen: screen,
    access: { status: "idle", errorMessage: null },
    jurorLabel: data.name,
    round: active ? { number: active.numero, startupName: active.startup_nombre } : null,
    criteria: JURY_CRITERIA,
    vote: { draft: null, confirming: false, submitting: false, errorMessage: null },
    votes: { emitted: cast, total: data.totalJurors },
  };
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
