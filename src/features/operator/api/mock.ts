import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { EVENT_CONFIG } from "@/shared/domain/config";
import { livePrice } from "@/shared/domain/pricing";
import { startupScore } from "@/shared/domain/scoring";
import { calcVerdict } from "@/shared/domain/verdict";
import type { Decision } from "@/shared/domain/types";

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
 * Implementación de muestra del estado del operador. Reproduce las fases del prototipo: abrir,
 * última llamada con temporizador de 60 s y cierre automático, cierre con habilitación de la
 * votación, veredicto y anulación. Reemplazar el reductor por la API cuando exista la capa de
 * datos; la interfaz de OperatorStateApi se conserva.
 */

/** Código de acceso de la muestra. Corresponde al código de demostración del prototipo. */
export const MOCK_OPERATOR_CODE = "OP-2026";

/** Intervalo del reloj de la muestra, usado para la cuenta regresiva y el cierre automático. */
const MOCK_TICK_MS = 1_000;

const TOTAL_ROUNDS = 5;
const JURY_SIZE = 4;
const ATTENDEE_COUNT = 74;
const INVESTOR_COUNT = 60;
const INITIAL_BALANCE = 10_000;
const OPERATOR_NAME = "op.1";
const DEFAULT_MANUAL_BACKS = 2;

interface RoundScript {
  startupName: string;
  senses: JurorSense[];
}

/** Guion de las rondas de muestra. La ronda 2 reproduce la consola en votación con tres votos emitidos. */
const ROUND_SCRIPTS: RoundScript[] = [
  { startupName: "Aurora Agro", senses: ["backs", "backs", "rejects", "abstains"] },
  { startupName: "Nodo Solar", senses: ["backs", "backs", "rejects", "backs"] },
  { startupName: "Aqua Lima", senses: ["backs", "abstains", "rejects", "backs"] },
  { startupName: "Tejido Vivo", senses: ["rejects", "rejects", "backs", "backs"] },
  { startupName: "Ruta Verde", senses: ["backs", "backs", "backs", "backs"] },
];

interface MockPosition {
  attendeeId: string;
  round: number;
  amount: number;
  returnAmount: number | null;
}

interface JurorState {
  id: string;
  label: string;
  emitted: boolean;
  /** Sentido oculto hasta la revelación. */
  sense: JurorSense;
}

/** Resultado de una ronda terminada. Las rondas sin resultado siguen abiertas o programadas. */
interface RoundResult {
  status: "SETTLED" | "CANCELLED";
  multiplier: number;
  fraction: number;
  cancelMode: CancelMode | null;
}

/** Instantánea previa a una acción de mercado, usada por Deshacer. */
interface HistoryEntry {
  label: string;
  status: RoundStatus;
  lastCallStartedAt: number | null;
  log: LogEntryView[];
}

interface MockState {
  roundIndex: number;
  status: RoundStatus;
  jurors: JurorState[];
  /** Instante de inicio de la última llamada, en milisegundos. Es null fuera de esa fase. */
  lastCallStartedAt: number | null;
  manual: boolean;
  manualBacks: number;
  results: Record<number, RoundResult>;
  /** Registro cronológico de todas las acciones del evento. */
  log: LogEntryView[];
  history: HistoryEntry[];
  balances: Record<string, number>;
  positions: MockPosition[];
  nextLogId: number;
}

type MockCommand =
  | { type: "runAction"; id: OperatorActionId; now: number }
  | { type: "undo"; now: number }
  | { type: "cancel"; mode: CancelMode; now: number }
  | { type: "setManual"; enabled: boolean }
  | { type: "setManualBacks"; backs: number }
  | { type: "simulateVote"; jurorId: string }
  | { type: "tick"; now: number };

export interface OperatorStateApi {
  viewModel: OperatorViewModel;
  runAction: (id: OperatorActionId) => void;
  undo: () => void;
  cancelRound: (mode: CancelMode) => void;
  setManualMode: (enabled: boolean) => void;
  setManualBacks: (backs: number) => void;
  simulateJurorVote: (jurorId: string) => void;
}

/** Valida el código de acceso de la muestra. */
export function verifyOperatorCode(code: string): boolean {
  return code.trim().toUpperCase() === MOCK_OPERATOR_CODE;
}

/** Convierte un sentido de voto en la decisión del dominio. */
function decisionOf(sense: JurorSense): Decision {
  if (sense === "backs") return "BACK";
  if (sense === "rejects") return "REJECT";
  return "ABSTAIN";
}

/** Decisiones del modo manual: los jurados indicados respaldan y el resto rechaza. */
function manualDecisions(backs: number): Decision[] {
  return Array.from({ length: JURY_SIZE }, (_, index) => (index < backs ? "BACK" : "REJECT"));
}

function createInitialState(): MockState {
  const positions = seedPositions();
  const balances: Record<string, number> = {};
  for (let index = 0; index < ATTENDEE_COUNT; index += 1) {
    balances[attendeeId(index)] = INITIAL_BALANCE;
  }

  // Liquidar la ronda 1 de muestra y descontar la inversión de la ronda 2 en curso.
  const round1 = calcVerdict(ROUND_SCRIPTS[0].senses.map(decisionOf));
  const round1Multiplier = round2(round1.multiplier);
  for (const position of positions) {
    if (position.round === 1) {
      position.returnAmount = Math.round(position.amount * round1Multiplier);
      balances[position.attendeeId] += position.returnAmount - position.amount;
    } else {
      balances[position.attendeeId] -= position.amount;
    }
  }

  return {
    roundIndex: 1,
    status: "VOTING",
    jurors: buildJurors(ROUND_SCRIPTS[1].senses, 3),
    lastCallStartedAt: null,
    manual: false,
    manualBacks: DEFAULT_MANUAL_BACKS,
    results: {
      0: { status: "SETTLED", multiplier: round1Multiplier, fraction: round1.fraction, cancelMode: null },
    },
    log: [
      seedLog(1, "15:00:00", "OPEN", 1),
      seedLog(2, "15:06:00", "LAST_CALL", 1),
      seedLog(3, "15:07:00", "CLOSE", 1),
      seedLog(4, "15:08:00", "ENABLE_VOTING", 1),
      seedLog(5, "15:09:00", "REVEAL", 1),
      seedLog(6, "15:10:00", "OPEN", 2),
      seedLog(7, "15:18:00", "LAST_CALL", 2),
      seedLog(8, "15:19:00", "CLOSE", 2),
      seedLog(9, "15:19:30", "ENABLE_VOTING", 2),
    ],
    history: [],
    balances,
    positions,
    nextLogId: 10,
  };
}

function attendeeId(index: number): string {
  return `asistente-${pad2(index + 1)}`;
}

function seedPositions(): MockPosition[] {
  const positions: MockPosition[] = [];
  for (let index = 0; index < INVESTOR_COUNT; index += 1) {
    positions.push({
      attendeeId: attendeeId(index),
      round: 1,
      amount: 250 + (index % 15) * 200,
      returnAmount: null,
    });
    positions.push({
      attendeeId: attendeeId(index),
      round: 2,
      amount: 250 + ((index * 7) % 15) * 200,
      returnAmount: null,
    });
  }
  return positions;
}

function seedLog(index: number, time: string, action: string, roundNumber: number): LogEntryView {
  return {
    id: `log-${index}`,
    time,
    roundNumber,
    label: OPERATOR_ACTION_LABELS[action] ?? action,
    operator: OPERATOR_NAME,
  };
}

function buildJurors(senses: JurorSense[], emittedCount: number): JurorState[] {
  return Array.from({ length: JURY_SIZE }, (_, index) => ({
    id: `jurado-${index + 1}`,
    label: `Jurado ${index + 1}`,
    emitted: index < emittedCount,
    sense: senses[index],
  }));
}

/** Agrega una entrada al registro con la hora indicada. */
function appendLog(
  state: MockState,
  action: string,
  now: number,
): Pick<MockState, "log" | "nextLogId"> {
  const entry: LogEntryView = {
    id: `log-${state.nextLogId}`,
    time: timeOf(now),
    roundNumber: state.roundIndex + 1,
    label: OPERATOR_ACTION_LABELS[action] ?? action,
    operator: OPERATOR_NAME,
  };
  return { log: [...state.log, entry], nextLogId: state.nextLogId + 1 };
}

/** Liquida las posiciones de la ronda actual con el factor indicado y actualiza los saldos. */
function settlePositions(state: MockState, factor: number): Pick<MockState, "balances" | "positions"> {
  const roundNumber = state.roundIndex + 1;
  const balances = { ...state.balances };
  const positions = state.positions.map((position) => {
    if (position.round !== roundNumber || position.returnAmount !== null) {
      return position;
    }
    const returnAmount = Math.round(position.amount * factor);
    balances[position.attendeeId] += returnAmount;
    return { ...position, returnAmount };
  });
  return { balances, positions };
}

function reduce(state: MockState, command: MockCommand): MockState {
  switch (command.type) {
    case "runAction":
      return runAction(state, command.id, command.now);
    case "undo":
      return undo(state, command.now);
    case "cancel":
      return cancelRound(state, command.mode, command.now);
    case "setManual":
      return setManual(state, command.enabled);
    case "setManualBacks":
      return setManualBacks(state, command.backs);
    case "simulateVote":
      return simulateVote(state, command.jurorId);
    case "tick":
      return tick(state, command.now);
  }
}

function runAction(state: MockState, id: OperatorActionId, now: number): MockState {
  switch (id) {
    case "open":
      if (state.status !== "SCHEDULED") return state;
      return withHistory(state, "OPEN", ["OPEN"], { status: "OPEN" }, now);
    case "last_call":
      if (state.status !== "OPEN") return state;
      return withHistory(
        state,
        "LAST_CALL",
        ["LAST_CALL"],
        { status: "LAST_CALL", lastCallStartedAt: now },
        now,
      );
    case "close":
      return closeMarket(state, now, true);
    case "reveal":
      return reveal(state, now);
    case "next":
      return nextRound(state);
  }
}

/** Guarda una instantánea para Deshacer, aplica el cambio y añade las entradas del registro. */
function withHistory(
  state: MockState,
  label: string,
  actions: string[],
  change: Partial<Pick<MockState, "status" | "lastCallStartedAt">>,
  now: number,
): MockState {
  const snapshot: HistoryEntry = {
    label,
    status: state.status,
    lastCallStartedAt: state.lastCallStartedAt,
    log: state.log,
  };
  let next: MockState = { ...state, ...change };
  for (const action of actions) {
    const logged = appendLog(next, action, now);
    next = { ...next, log: logged.log, nextLogId: logged.nextLogId };
  }
  return { ...next, history: [...state.history, snapshot] };
}

/** Cierra el mercado y habilita la votación. El cierre automático no se registra en Deshacer. */
function closeMarket(state: MockState, now: number, recordHistory: boolean): MockState {
  if (state.status !== "OPEN" && state.status !== "LAST_CALL") {
    return state;
  }
  const actions = recordHistory ? ["CLOSE", "ENABLE_VOTING"] : ["AUTO_CLOSE", "ENABLE_VOTING"];
  const change = { status: "VOTING" as const, lastCallStartedAt: null };
  if (recordHistory) {
    return withHistory(state, "CLOSE", actions, change, now);
  }
  let next: MockState = { ...state, ...change };
  for (const action of actions) {
    const logged = appendLog(next, action, now);
    next = { ...next, log: logged.log, nextLogId: logged.nextLogId };
  }
  return next;
}

/** Revela el veredicto cuando votaron todos los jurados o cuando el modo manual está activo. */
function reveal(state: MockState, now: number): MockState {
  if (state.status !== "VOTING") {
    return state;
  }
  const missing = state.jurors.filter((juror) => !juror.emitted).length;
  if (missing > 0 && !state.manual) {
    return state;
  }

  const verdict = calcVerdict(
    state.manual
      ? manualDecisions(state.manualBacks)
      : state.jurors.map((juror) => decisionOf(juror.sense)),
  );
  const multiplier = round2(verdict.multiplier);
  const logged = appendLog(state, state.manual ? "MANUAL_SETTLE" : "REVEAL", now);
  const settled = settlePositions({ ...state, ...logged }, multiplier);

  return {
    ...state,
    ...logged,
    ...settled,
    status: "SETTLED",
    manual: false,
    history: [],
    results: {
      ...state.results,
      [state.roundIndex]: {
        status: "SETTLED",
        multiplier,
        fraction: verdict.fraction,
        cancelMode: null,
      },
    },
  };
}

function nextRound(state: MockState): MockState {
  const closed = state.status === "SETTLED" || state.status === "CANCELLED";
  if (!closed || state.roundIndex >= TOTAL_ROUNDS - 1) {
    return state;
  }
  const roundIndex = state.roundIndex + 1;
  return {
    ...state,
    roundIndex,
    status: "SCHEDULED",
    jurors: buildJurors(ROUND_SCRIPTS[roundIndex].senses, 0),
    lastCallStartedAt: null,
    manual: false,
    history: [],
  };
}

/** Anula la ronda en votación: el factor es 1.0x y el modo queda registrado. */
function cancelRound(state: MockState, mode: CancelMode, now: number): MockState {
  if (state.status !== "VOTING") {
    return state;
  }
  const logged = appendLog(state, mode === "refund" ? "CANCEL_REFUND" : "CANCEL_SETTLE_1X", now);
  const settled = settlePositions({ ...state, ...logged }, 1);
  return {
    ...state,
    ...logged,
    ...settled,
    status: "CANCELLED",
    manual: false,
    history: [],
    results: {
      ...state.results,
      [state.roundIndex]: { status: "CANCELLED", multiplier: 1, fraction: 0, cancelMode: mode },
    },
  };
}

function setManual(state: MockState, enabled: boolean): MockState {
  if (state.status !== "VOTING") {
    return state;
  }
  return { ...state, manual: enabled };
}

function setManualBacks(state: MockState, backs: number): MockState {
  if (!Number.isInteger(backs) || backs < 0 || backs > JURY_SIZE) {
    return state;
  }
  return { ...state, manualBacks: backs };
}

function simulateVote(state: MockState, jurorId: string): MockState {
  if (state.status !== "VOTING") {
    return state;
  }
  return {
    ...state,
    jurors: state.jurors.map((juror) =>
      juror.id === jurorId ? { ...juror, emitted: true } : juror,
    ),
  };
}

/** Cierre automático de la última llamada cuando el temporizador llega a cero. */
function tick(state: MockState, now: number): MockState {
  if (state.status !== "LAST_CALL" || state.lastCallStartedAt === null) {
    return state;
  }
  if (remainingSeconds(state.lastCallStartedAt, now) > 0) {
    return state;
  }
  return closeMarket(state, now, false);
}

function undo(state: MockState, now: number): MockState {
  if (!canUndo(state)) {
    return state;
  }
  const previous = state.history[state.history.length - 1];
  const logged = appendLog({ ...state, log: previous.log }, "UNDO", now);
  return {
    ...state,
    status: previous.status,
    lastCallStartedAt: previous.lastCallStartedAt,
    log: logged.log,
    nextLogId: logged.nextLogId,
    history: state.history.slice(0, -1),
  };
}

function canUndo(state: MockState): boolean {
  if (state.history.length === 0) {
    return false;
  }
  // Deshacer el cierre no es posible una vez que el jurado ha votado.
  const anyEmitted = state.jurors.some((juror) => juror.emitted);
  return !(state.status === "VOTING" && anyEmitted);
}

/** Segundos restantes de la última llamada a partir de su instante de inicio. */
function remainingSeconds(startedAt: number, now: number): number {
  const elapsed = Math.floor((now - startedAt) / 1000);
  return Math.max(0, EVENT_CONFIG.lastCallSeconds - elapsed);
}

/** Puntajes de las rondas liquidadas, de mayor a menor. */
function standingsOf(state: MockState): StandingView[] {
  const views: StandingView[] = [];
  for (const [key, result] of Object.entries(state.results)) {
    if (result.status !== "SETTLED") continue;
    const roundIndex = Number(key);
    const roundNumber = roundIndex + 1;
    const investors = state.positions.filter((position) => position.round === roundNumber).length;
    views.push({
      roundNumber,
      startupName: ROUND_SCRIPTS[roundIndex].startupName,
      score: round2(startupScore(result.fraction, investors / ATTENDEE_COUNT)),
      fraction: result.fraction,
    });
  }
  return views.sort((a, b) => b.score - a.score || (b.fraction ?? 0) - (a.fraction ?? 0));
}

function toViewModel(state: MockState, now: number): OperatorViewModel {
  const roundNumber = state.roundIndex + 1;
  const script = ROUND_SCRIPTS[state.roundIndex];
  const result = state.results[state.roundIndex];
  const revealed = state.status === "SETTLED" || state.status === "CANCELLED";
  const missing = state.jurors.filter((juror) => !juror.emitted).length;

  const roundPositions = state.positions.filter((position) => position.round === roundNumber);
  const accumulated = roundPositions.reduce((sum, position) => sum + position.amount, 0);

  const jurors: JurorVoteView[] = state.jurors.map((juror) => ({
    id: juror.id,
    label: juror.label,
    emitted: juror.emitted,
    sense: revealed ? juror.sense : null,
  }));

  const revealEnabled = state.status === "VOTING" && (missing === 0 || state.manual);
  const actions: OperatorActionView[] = [
    {
      id: "open",
      label: "Abrir mercado",
      done: state.status !== "SCHEDULED",
      enabled: state.status === "SCHEDULED",
      blockedReason: null,
    },
    {
      id: "last_call",
      label: "Declarar última llamada",
      done: ["LAST_CALL", "CLOSED", "VOTING", "SETTLED"].includes(state.status),
      enabled: state.status === "OPEN",
      blockedReason: state.status === "OPEN" ? null : "Requiere la ronda abierta.",
    },
    {
      id: "close",
      label: "Cerrar mercado",
      done: ["CLOSED", "VOTING", "SETTLED"].includes(state.status),
      enabled: state.status === "OPEN" || state.status === "LAST_CALL",
      blockedReason:
        state.status === "OPEN" || state.status === "LAST_CALL"
          ? null
          : "Requiere el mercado abierto.",
    },
    {
      id: "reveal",
      label: "Revelar veredicto",
      done: state.status === "SETTLED",
      enabled: revealEnabled,
      blockedReason: revealEnabled
        ? null
        : state.status === "VOTING"
          ? missing === 1
            ? "Bloqueado: falta 1 voto"
            : `Bloqueado: faltan ${missing} votos`
          : "Requiere votación habilitada.",
    },
    {
      id: "next",
      label: "Siguiente startup",
      done: false,
      enabled: revealed && state.roundIndex < TOTAL_ROUNDS - 1,
      blockedReason: !revealed
        ? "Avanza al abrir la siguiente ronda."
        : state.roundIndex >= TOTAL_ROUNDS - 1
          ? "Es la última startup del evento"
          : null,
    },
  ];

  const balances: BalanceRow[] = Array.from({ length: ATTENDEE_COUNT }, (_, index) => ({
    attendeeId: attendeeId(index),
    attendeeName: `Asistente ${pad2(index + 1)}`,
    balance: state.balances[attendeeId(index)],
  }));

  const positions: PositionRow[] = state.positions.map((position) => ({
    attendeeId: position.attendeeId,
    attendeeName: `Asistente ${pad2(Number(position.attendeeId.slice(-2)))}`,
    round: position.round,
    startupName: ROUND_SCRIPTS[position.round - 1].startupName,
    amount: position.amount,
    returnAmount: position.returnAmount,
  }));

  const rounds: RoundSummaryView[] = ROUND_SCRIPTS.map((item, index) => {
    const past = state.results[index];
    const status: RoundStatus =
      index === state.roundIndex ? state.status : past?.status ?? "SCHEDULED";
    return {
      number: index + 1,
      startupName: item.startupName,
      status,
      multiplier: past?.status === "SETTLED" ? past.multiplier : null,
    };
  });

  const lastCallRemaining =
    state.status === "LAST_CALL" && state.lastCallStartedAt !== null
      ? remainingSeconds(state.lastCallStartedAt, now)
      : null;

  return {
    round: {
      number: roundNumber,
      total: TOTAL_ROUNDS,
      startupName: script.startupName,
      status: state.status,
      multiplier: result?.status === "SETTLED" ? result.multiplier : null,
      cancelMode: result?.cancelMode ?? null,
    },
    rounds,
    actions,
    jurors,
    market: {
      accumulated,
      uniqueInvestors: roundPositions.length,
      connectedAttendees: ATTENDEE_COUNT,
      price: livePrice(accumulated),
      lastCallRemaining,
    },
    standings: standingsOf(state),
    log: [...state.log].reverse(),
    canUndo: canUndo(state),
    canCancel: state.status === "VOTING",
    canManualSettle: state.status === "VOTING",
    manualMode: { enabled: state.manual, backs: state.manualBacks },
    balances,
    positions,
  };
}

/**
 * Estado de la consola del operador con datos de muestra. Un reloj de MOCK_TICK_MS actualiza la
 * cuenta regresiva y cierra la última llamada cuando el temporizador llega a cero.
 */
export function useOperatorState(): OperatorStateApi {
  const [state, dispatch] = useReducer(reduce, undefined, createInitialState);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      dispatch({ type: "tick", now: current });
    }, MOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const viewModel = useMemo(() => toViewModel(state, now), [state, now]);

  const runAction = useCallback(
    (id: OperatorActionId) => dispatch({ type: "runAction", id, now: Date.now() }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: "undo", now: Date.now() }), []);
  const cancelRound = useCallback(
    (mode: CancelMode) => dispatch({ type: "cancel", mode, now: Date.now() }),
    [],
  );
  const setManualMode = useCallback(
    (enabled: boolean) => dispatch({ type: "setManual", enabled }),
    [],
  );
  const setManualBacks = useCallback(
    (backs: number) => dispatch({ type: "setManualBacks", backs }),
    [],
  );
  const simulateJurorVote = useCallback(
    (jurorId: string) => dispatch({ type: "simulateVote", jurorId }),
    [],
  );

  return useMemo(
    () => ({
      viewModel,
      runAction,
      undo,
      cancelRound,
      setManualMode,
      setManualBacks,
      simulateJurorVote,
    }),
    [viewModel, runAction, undo, cancelRound, setManualMode, setManualBacks, simulateJurorVote],
  );
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

/** Hora local en formato HH:MM:SS. */
function timeOf(now: number): string {
  const date = new Date(now);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
