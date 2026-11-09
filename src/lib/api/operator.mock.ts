import { useCallback, useMemo, useReducer } from "react";

import type {
  BalanceRow,
  CancelMode,
  JurorSense,
  JurorVoteView,
  LogEntryView,
  ManualSettlementInput,
  OperatorActionId,
  OperatorActionView,
  OperatorViewModel,
  PositionRow,
  RoundStatus,
} from "./operator.types";

/**
 * Implementación mock del estado del operador.
 * Reemplazar el reductor por llamadas a Neon cuando exista la capa de datos; la interfaz
 * de OperatorStateApi se conserva.
 */

/** Código de acceso de la maqueta. No corresponde a un código real. */
export const MOCK_OPERATOR_CODE = "START-OPERADOR";

const TOTAL_ROUNDS = 5;
const JURY_SIZE = 4;
const ATTENDEE_COUNT = 74;
const INVESTOR_COUNT = 60;
const INITIAL_BALANCE = 10000;
const OPERATOR_NAME = "op.1";
const MIN_MULTIPLIER = 0.2;
const MAX_MULTIPLIER = 1.8;

interface RoundScript {
  startupName: string;
  senses: JurorSense[];
  status: RoundStatus;
  price: number;
}

/** Guion de las rondas de muestra. La ronda 2 reproduce la consola en votación del wireframe C1. */
const ROUND_SCRIPTS: RoundScript[] = [
  {
    startupName: "Aqua Ruta",
    senses: ["respalda", "respalda", "rechaza", "abstiene"],
    status: "LIQUIDADA",
    price: 100,
  },
  {
    startupName: "Solar Nodo",
    senses: ["respalda", "respalda", "rechaza", "respalda"],
    status: "EN_VOTACION",
    price: 118,
  },
  {
    startupName: "Mercado Verde",
    senses: ["respalda", "abstiene", "rechaza", "respalda"],
    status: "PROGRAMADA",
    price: 100,
  },
  {
    startupName: "Cosecha Lab",
    senses: ["rechaza", "rechaza", "respalda", "respalda"],
    status: "PROGRAMADA",
    price: 100,
  },
  {
    startupName: "Red Mantis",
    senses: ["respalda", "respalda", "respalda", "respalda"],
    status: "PROGRAMADA",
    price: 100,
  },
];

interface AttendeeSeed {
  id: string;
  name: string;
}

const ATTENDEES: AttendeeSeed[] = Array.from(
  { length: ATTENDEE_COUNT },
  (_, index) => ({
    id: `asistente-${pad2(index + 1)}`,
    name: `Asistente ${pad2(index + 1)}`,
  }),
);

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

/** Instantánea previa a una acción de mercado, usada por Deshacer. */
interface HistoryEntry {
  label: string;
  status: RoundStatus;
  completed: OperatorActionId[];
  log: LogEntryView[];
}

interface MockState {
  roundIndex: number;
  status: RoundStatus;
  completed: OperatorActionId[];
  jurors: JurorState[];
  multiplier: number | null;
  result: ManualSettlementInput["result"] | null;
  cancelMode: CancelMode | null;
  log: LogEntryView[];
  history: HistoryEntry[];
  balances: Record<string, number>;
  positions: MockPosition[];
  nextLogId: number;
}

type MockCommand =
  | { type: "runAction"; id: OperatorActionId }
  | { type: "undo" }
  | { type: "cancel"; mode: CancelMode }
  | { type: "manual"; input: ManualSettlementInput }
  | { type: "simulateVote"; jurorId: string };

export interface OperatorStateApi {
  viewModel: OperatorViewModel;
  runAction: (id: OperatorActionId) => void;
  undo: () => void;
  cancelRound: (mode: CancelMode) => void;
  settleManually: (input: ManualSettlementInput) => void;
  simulateJurorVote: (jurorId: string) => void;
}

/** Valida el código de acceso de la maqueta. */
export function verifyOperatorCode(code: string): boolean {
  return code.trim() === MOCK_OPERATOR_CODE;
}

/** Calcula el multiplicador: 0.2 + 1.6 x fracción de respaldo. Las abstenciones se excluyen. */
function computeMultiplier(senses: JurorSense[]): number {
  const supports = senses.filter((sense) => sense === "respalda").length;
  const valid = senses.filter((sense) => sense !== "abstiene").length;
  if (valid === 0) {
    // Supuesto: sin votos válidos se liquida a 1.0x. Confirmar con el dominio.
    return 1;
  }
  const fraction = supports / valid;
  return round2(0.2 + 1.6 * fraction);
}

function createInitialState(): MockState {
  const positions = seedPositions();
  const balances: Record<string, number> = {};
  for (const attendee of ATTENDEES) {
    balances[attendee.id] = INITIAL_BALANCE;
  }

  // Liquidar la ronda 1 de muestra y descontar la inversión de la ronda 2 en curso.
  const round1Multiplier = computeMultiplier(ROUND_SCRIPTS[0].senses);
  for (const position of positions) {
    if (position.round === 1) {
      position.returnAmount = Math.round(position.amount * round1Multiplier);
      balances[position.attendeeId] += position.returnAmount - position.amount;
    } else {
      balances[position.attendeeId] -= position.amount;
    }
  }

  const script = ROUND_SCRIPTS[1];
  return {
    roundIndex: 1,
    status: script.status,
    completed: ["abrir", "ultima_llamada", "cerrar"],
    jurors: buildJurors(script.senses, 3),
    multiplier: null,
    result: null,
    cancelMode: null,
    log: [
      seedLog(1, "15:00", "ABRIR"),
      seedLog(2, "15:08", "ULTIMA_LLAMADA"),
      seedLog(3, "15:09", "CERRAR"),
      seedLog(4, "15:10", "HABILITAR_VOTO"),
    ],
    history: [],
    balances,
    positions,
    nextLogId: 5,
  };
}

function seedPositions(): MockPosition[] {
  const positions: MockPosition[] = [];
  for (let index = 0; index < INVESTOR_COUNT; index += 1) {
    const attendeeId = ATTENDEES[index].id;
    positions.push({
      attendeeId,
      round: 1,
      amount: 250 + (index % 15) * 200,
      returnAmount: null,
    });
    positions.push({
      attendeeId,
      round: 2,
      amount: 250 + ((index * 7) % 15) * 200,
      returnAmount: null,
    });
  }
  return positions;
}

function seedLog(index: number, time: string, label: string): LogEntryView {
  return {
    id: `log-${index}`,
    time,
    label,
    operator: OPERATOR_NAME,
    detail: null,
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

function appendLog(
  state: MockState,
  label: string,
  detail: string | null = null,
): { log: LogEntryView[]; nextLogId: number } {
  const entry: LogEntryView = {
    id: `log-${state.nextLogId}`,
    time: currentTime(),
    label,
    operator: OPERATOR_NAME,
    detail,
  };
  return { log: [...state.log, entry], nextLogId: state.nextLogId + 1 };
}

/** Liquida las posiciones de la ronda actual con el factor indicado y actualiza los saldos. */
function settleRound(
  state: MockState,
  status: "LIQUIDADA" | "ANULADA",
  multiplier: number | null,
): MockState {
  const roundNumber = state.roundIndex + 1;
  const factor = multiplier ?? 1;
  const balances = { ...state.balances };
  const positions = state.positions.map((position) => {
    if (position.round !== roundNumber || position.returnAmount !== null) {
      return position;
    }
    const returnAmount = Math.round(position.amount * factor);
    balances[position.attendeeId] += returnAmount;
    return { ...position, returnAmount };
  });
  return { ...state, status, multiplier, balances, positions, history: [] };
}

function reduce(state: MockState, command: MockCommand): MockState {
  switch (command.type) {
    case "runAction":
      return runAction(state, command.id);
    case "undo":
      return undo(state);
    case "cancel":
      return cancelRound(state, command.mode);
    case "manual":
      return manualSettle(state, command.input);
    case "simulateVote":
      return simulateVote(state, command.jurorId);
  }
}

function runAction(state: MockState, id: OperatorActionId): MockState {
  switch (id) {
    case "abrir":
      return marketStep(state, id, "PROGRAMADA", "ABIERTA", ["ABRIR"]);
    case "ultima_llamada":
      return marketStep(state, id, "ABIERTA", "ULTIMA_LLAMADA", [
        "ULTIMA_LLAMADA",
      ]);
    case "cerrar":
      return closeMarket(state);
    case "revelar":
      return reveal(state);
    case "siguiente":
      return nextRound(state);
  }
}

/** Avanza un estado de mercado y registra la acción para poder deshacerla. */
function marketStep(
  state: MockState,
  id: OperatorActionId,
  from: RoundStatus,
  to: RoundStatus,
  logLabels: string[],
): MockState {
  if (state.status !== from) {
    return state;
  }
  return withHistory(state, logLabels[0], logLabels, {
    status: to,
    completed: [...state.completed, id],
  });
}

/** Cierra el mercado y habilita la votación del jurado en un solo paso. */
function closeMarket(state: MockState): MockState {
  if (state.status !== "ABIERTA" && state.status !== "ULTIMA_LLAMADA") {
    return state;
  }
  return withHistory(state, "CERRAR", ["CERRAR", "HABILITAR_VOTO"], {
    status: "EN_VOTACION",
    completed: [...state.completed, "cerrar"],
  });
}

/** Guarda una instantánea para Deshacer, aplica el cambio y añade las entradas del registro. */
function withHistory(
  state: MockState,
  label: string,
  logLabels: string[],
  change: Pick<MockState, "status" | "completed">,
): MockState {
  const snapshot: HistoryEntry = {
    label,
    status: state.status,
    completed: state.completed,
    log: state.log,
  };
  let next: MockState = { ...state, ...change };
  for (const logLabel of logLabels) {
    const logged = appendLog(next, logLabel);
    next = { ...next, log: logged.log, nextLogId: logged.nextLogId };
  }
  return { ...next, history: [...state.history, snapshot] };
}

function reveal(state: MockState): MockState {
  if (state.status !== "EN_VOTACION") {
    return state;
  }
  const missing = state.jurors.filter((juror) => !juror.emitted).length;
  if (missing > 0) {
    return state;
  }
  const multiplier = computeMultiplier(state.jurors.map((juror) => juror.sense));
  const logged = appendLog(state, "REVELAR", `x${multiplier.toFixed(2)}`);
  const settled = settleRound(state, "LIQUIDADA", multiplier);
  return {
    ...settled,
    completed: [...state.completed, "revelar"],
    log: logged.log,
    nextLogId: logged.nextLogId,
  };
}

function nextRound(state: MockState): MockState {
  const closed = state.status === "LIQUIDADA" || state.status === "ANULADA";
  if (!closed || state.roundIndex >= TOTAL_ROUNDS - 1) {
    return state;
  }
  const roundIndex = state.roundIndex + 1;
  const script = ROUND_SCRIPTS[roundIndex];
  return {
    ...state,
    roundIndex,
    status: "PROGRAMADA",
    completed: [],
    jurors: buildJurors(script.senses, 0),
    multiplier: null,
    result: null,
    cancelMode: null,
    log: [],
    history: [],
  };
}

function cancelRound(state: MockState, mode: CancelMode): MockState {
  const cancellable =
    state.status === "ABIERTA" ||
    state.status === "ULTIMA_LLAMADA" ||
    state.status === "EN_VOTACION";
  if (!cancellable) {
    return state;
  }
  const logged = appendLog(
    state,
    "ANULAR",
    mode === "devolver" ? "devolver lo invertido" : "liquidar a 1.0x",
  );
  const settled = settleRound(
    { ...state, log: logged.log, nextLogId: logged.nextLogId },
    "ANULADA",
    mode === "liquidar_1x" ? 1 : null,
  );
  return { ...settled, cancelMode: mode };
}

function manualSettle(
  state: MockState,
  input: ManualSettlementInput,
): MockState {
  const validMultiplier =
    Number.isFinite(input.multiplier) &&
    input.multiplier >= MIN_MULTIPLIER &&
    input.multiplier <= MAX_MULTIPLIER;
  if (state.status !== "EN_VOTACION" || !validMultiplier) {
    return state;
  }
  const multiplier = round2(input.multiplier);
  const logged = appendLog(
    state,
    "LIQUIDAR_MANUAL",
    `x${multiplier.toFixed(2)} · ${input.result === "aprobada" ? "aprobada" : "no aprobada"}`,
  );
  const settled = settleRound(
    { ...state, log: logged.log, nextLogId: logged.nextLogId },
    "LIQUIDADA",
    multiplier,
  );
  return { ...settled, result: input.result };
}

function simulateVote(state: MockState, jurorId: string): MockState {
  if (state.status !== "EN_VOTACION") {
    return state;
  }
  return {
    ...state,
    jurors: state.jurors.map((juror) =>
      juror.id === jurorId ? { ...juror, emitted: true } : juror,
    ),
  };
}

function undo(state: MockState): MockState {
  if (!canUndo(state)) {
    return state;
  }
  const previous = state.history[state.history.length - 1];
  const logged = appendLog(
    { ...state, log: previous.log },
    "DESHACER",
    previous.label,
  );
  return {
    ...state,
    status: previous.status,
    completed: previous.completed,
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
  return !(state.status === "EN_VOTACION" && anyEmitted);
}

function toViewModel(state: MockState): OperatorViewModel {
  const roundNumber = state.roundIndex + 1;
  const script = ROUND_SCRIPTS[state.roundIndex];
  const revealed = state.status === "LIQUIDADA" || state.status === "ANULADA";
  const missing = state.jurors.filter((juror) => !juror.emitted).length;

  const roundPositions = state.positions.filter(
    (position) => position.round === roundNumber,
  );
  const accumulated = roundPositions.reduce(
    (sum, position) => sum + position.amount,
    0,
  );

  const jurors: JurorVoteView[] = state.jurors.map((juror) => ({
    id: juror.id,
    label: juror.label,
    emitted: juror.emitted,
    sense: revealed ? juror.sense : null,
  }));

  const actions: OperatorActionView[] = [
    {
      id: "abrir",
      label: "Abrir mercado",
      done: state.completed.includes("abrir"),
      enabled: state.status === "PROGRAMADA",
      blockedReason: null,
    },
    {
      id: "ultima_llamada",
      label: "Última llamada",
      done: state.completed.includes("ultima_llamada"),
      enabled: state.status === "ABIERTA",
      blockedReason: null,
    },
    {
      id: "cerrar",
      label: "Cerrar mercado",
      done: state.completed.includes("cerrar"),
      enabled:
        state.status === "ABIERTA" || state.status === "ULTIMA_LLAMADA",
      blockedReason: null,
    },
    {
      id: "revelar",
      label: "Revelar veredicto",
      done: state.status === "LIQUIDADA",
      enabled: state.status === "EN_VOTACION" && missing === 0,
      blockedReason:
        state.status === "EN_VOTACION" && missing > 0
          ? `Bloqueado: falta ${missing} ${missing === 1 ? "voto" : "votos"}`
          : null,
    },
    {
      id: "siguiente",
      label: "Siguiente startup",
      done: false,
      enabled: revealed && state.roundIndex < TOTAL_ROUNDS - 1,
      blockedReason: !revealed
        ? "Se habilita al liquidar o anular la ronda"
        : state.roundIndex >= TOTAL_ROUNDS - 1
          ? "Es la última startup del evento"
          : null,
    },
  ];

  const balances: BalanceRow[] = ATTENDEES.map((attendee) => ({
    attendeeId: attendee.id,
    attendeeName: attendee.name,
    balance: state.balances[attendee.id],
  }));

  const attendeeNames = new Map(
    ATTENDEES.map((attendee) => [attendee.id, attendee.name]),
  );
  const positions: PositionRow[] = state.positions.map((position) => ({
    attendeeId: position.attendeeId,
    attendeeName: attendeeNames.get(position.attendeeId) ?? position.attendeeId,
    round: position.round,
    startupName: ROUND_SCRIPTS[position.round - 1].startupName,
    amount: position.amount,
    returnAmount: position.returnAmount,
  }));

  return {
    round: {
      number: roundNumber,
      total: TOTAL_ROUNDS,
      startupName: script.startupName,
      status: state.status,
      multiplier: state.multiplier,
      result: state.result,
      cancelMode: state.cancelMode,
    },
    screenSynced: true,
    actions,
    jurors,
    market: {
      accumulated,
      uniqueInvestors: roundPositions.length,
      connectedAttendees: ATTENDEE_COUNT,
      price: script.price,
    },
    log: state.log,
    canUndo: canUndo(state),
    canCancel:
      state.status === "ABIERTA" ||
      state.status === "ULTIMA_LLAMADA" ||
      state.status === "EN_VOTACION",
    canManualSettle: state.status === "EN_VOTACION",
    balances,
    positions,
  };
}

/**
 * Estado de la consola del operador con datos de muestra.
 * Devuelve el view model y las acciones que el operador puede disparar.
 */
export function useOperatorState(): OperatorStateApi {
  const [state, dispatch] = useReducer(reduce, undefined, createInitialState);

  const viewModel = useMemo(() => toViewModel(state), [state]);

  const runAction = useCallback(
    (id: OperatorActionId) => dispatch({ type: "runAction", id }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const cancelRound = useCallback(
    (mode: CancelMode) => dispatch({ type: "cancel", mode }),
    [],
  );
  const settleManually = useCallback(
    (input: ManualSettlementInput) => dispatch({ type: "manual", input }),
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
      settleManually,
      simulateJurorVote,
    }),
    [viewModel, runAction, undo, cancelRound, settleManually, simulateJurorVote],
  );
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function currentTime(): string {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
