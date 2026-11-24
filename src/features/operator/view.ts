import { ACTIVE_ROUND_STATUSES, JUROR_ONLINE_SECONDS } from "./thresholds";
import { MAIN_ACTION_LABELS, STEP_LABELS, actionLabel, formatTime } from "./labels";
import {
  ROUND_STEPS,
  type BalanceRow,
  type CancelMode,
  type JurorStatus,
  type JurorView,
  type LogEntryView,
  type MainActionView,
  type OperatorActionId,
  type OperatorRole,
  type OperatorViewModel,
  type PhaseDurations,
  type PositionRow,
  type RoundStatus,
  type RoundStepView,
  type ScheduleView,
  type StandingView,
} from "./types";

/*
 * Constructor puro del view model de la consola. No accede a la base de datos ni al navegador: el
 * servidor (server/mappers.ts) y los datos de muestra (api/mock.ts) arman un OperatorSnapshot con
 * valores ya convertidos y obtienen aquí el mismo view model.
 */

export interface SnapshotRound {
  number: number;
  startupName: string;
  sdg: string | null;
  status: RoundStatus;
  multiplier: number | null;
  juryScore: number | null;
  /** Hora ISO en que termina la fase actual. Null sin cronómetro o en pausa. */
  phaseEndsAt: string | null;
  /** Segundos congelados por la pausa. Null fuera de pausa. */
  pausedSeconds: number | null;
  accumulated: number;
  uniqueInvestors: number;
  price: number;
}

export interface SnapshotJuror {
  id: string;
  name: string;
  sent: boolean;
  abstains: boolean;
  /** Tiene notas en borrador para la ronda. */
  drafting: boolean;
  /** Puntaje de 1 a 5 del envío. Se descarta hasta que la ronda se liquida. */
  score: number | null;
  secondsSinceSeen: number | null;
}

export interface SnapshotAction {
  id: string;
  at: Date;
  roundNumber: number;
  /** Acción en el nombre del dominio o en el valor de la base sin traducir. */
  action: string;
  operator: string;
  reason: string | null;
}

export interface OperatorSnapshot {
  now: Date;
  operator: { name: string; role: OperatorRole };
  flags: { eventStarted: boolean; manualMode: boolean };
  durations: PhaseDurations;
  rounds: readonly SnapshotRound[];
  /** Hora ISO en que se abrió la primera ronda: el inicio real del evento. */
  firstOpenAt: string | null;
  /** Envíos de los jurados en la ronda de referencia. */
  jurors: readonly SnapshotJuror[];
  /** Anulación registrada para la ronda de referencia. */
  cancelMode: CancelMode | null;
  attendeesOnline: number;
  attendeesTotal: number;
  actions: readonly SnapshotAction[];
  balances: readonly BalanceRow[];
  positions: readonly PositionRow[];
}

const FINISHED: ReadonlySet<RoundStatus> = new Set<RoundStatus>(["SETTLED", "CANCELLED"]);

/** Paso actual de la ronda según su estado. Null cuando la ronda terminó. */
export function currentStepOf(status: RoundStatus): OperatorActionId | null {
  switch (status) {
    case "SCHEDULED":
      return "open";
    case "OPEN":
      return "last_call";
    case "LAST_CALL":
      return "close";
    case "CLOSED":
      return "enable_voting";
    case "VOTING":
      return "reveal";
    default:
      return null;
  }
}

/**
 * Ronda que controla el operador: la que está en curso; si no hay, la siguiente programada; si
 * tampoco, la última terminada.
 */
export function referenceRound<T extends { number: number; status: RoundStatus }>(
  rounds: readonly T[],
): T | undefined {
  const sorted = [...rounds].sort((a, b) => a.number - b.number);
  const finished = sorted.filter((round) => FINISHED.has(round.status));
  return (
    sorted.find((round) => ACTIVE_ROUND_STATUSES.has(round.status)) ??
    sorted.find((round) => round.status === "SCHEDULED") ??
    finished[finished.length - 1] ??
    sorted[0]
  );
}

/** Línea de pasos de la ronda: hechos, el actual y los pendientes. */
export function buildSteps(status: RoundStatus): RoundStepView[] {
  const current = currentStepOf(status);
  const currentIndex = current === null ? -1 : ROUND_STEPS.indexOf(current);
  return ROUND_STEPS.map((id, index) => {
    let state: RoundStepView["state"] = "pending";
    if (status === "SETTLED" || (currentIndex >= 0 && index < currentIndex)) state = "done";
    else if (index === currentIndex) state = "current";
    return { id, label: STEP_LABELS[id], state };
  });
}

/** Texto de los envíos que faltan para revelar. */
function missingText(missing: number): string {
  return missing === 1 ? "Falta 1 jurado por enviar" : `Faltan ${missing} jurados por enviar`;
}

/**
 * Paso válido de la ronda (RF-06). Revelar queda bloqueado hasta que los cuatro jurados envíen
 * (RF-18); con todos abstenidos no hay puntaje que revelar.
 */
export function buildMainAction(
  status: RoundStatus,
  jurors: readonly SnapshotJuror[],
): MainActionView | null {
  const id = currentStepOf(status);
  if (id === null) return null;

  const view: MainActionView = {
    id,
    label: MAIN_ACTION_LABELS[id],
    enabled: true,
    blockedReason: null,
    hint: null,
  };

  if (id === "close") {
    view.hint = "Se cierra sola al llegar a 0:00.";
  }

  if (id === "reveal") {
    const sent = jurors.filter((juror) => juror.sent).length;
    const scored = jurors.filter((juror) => juror.sent && !juror.abstains).length;
    const missing = Math.max(0, jurors.length - sent);
    if (jurors.length === 0) {
      view.enabled = false;
      view.blockedReason = "No hay jurados registrados.";
    } else if (missing > 0) {
      view.enabled = false;
      view.blockedReason = missingText(missing);
    } else if (scored === 0) {
      view.enabled = false;
      view.blockedReason = "Todos los jurados se abstuvieron: anula la ronda o liquida a mano.";
    }
  }

  return view;
}

/** Estado de un jurado a partir de su envío y su borrador. */
function jurorStatusOf(juror: SnapshotJuror): JurorStatus {
  if (juror.sent) return juror.abstains ? "abstained" : "sent";
  return juror.drafting ? "drafting" : "pending";
}

/** Jurados de la ronda. El puntaje solo se incluye con la ronda liquidada (RF-17, RNF-11). */
export function buildJurors(
  jurors: readonly SnapshotJuror[],
  status: RoundStatus,
): JurorView[] {
  return jurors.map((juror) => ({
    id: juror.id,
    name: juror.name,
    status: jurorStatusOf(juror),
    online: juror.secondsSinceSeen !== null && juror.secondsSinceSeen < JUROR_ONLINE_SECONDS,
    lastSeenSeconds: juror.secondsSinceSeen === null ? null : Math.floor(juror.secondsSinceSeen),
    score: status === "SETTLED" && juror.sent && !juror.abstains ? juror.score : null,
  }));
}

/** Duración total de una ronda según la configuración. */
export function roundSeconds(durations: PhaseDurations): number {
  return (
    durations.pitch + durations.qa + durations.lastCall + durations.voting + durations.result
  );
}

/** Segundo de la ronda, desde la apertura, en que debería terminar cada estado según el plan. */
function plannedOffsetOf(status: RoundStatus, durations: PhaseDurations): number | null {
  const market = durations.pitch + durations.qa;
  switch (status) {
    case "SCHEDULED":
      return 0;
    case "OPEN":
      return market;
    case "LAST_CALL":
    case "CLOSED":
      return market + durations.lastCall;
    case "VOTING":
      return market + durations.lastCall + durations.voting;
    default:
      return null;
  }
}

/**
 * Adelanto o atraso del evento (tarea 5.3). El plan parte de la apertura real de la primera ronda
 * y suma la duración configurada de cada ronda. Se compara la hora en que terminaría el estado
 * actual (ahora más lo que resta del cronómetro) con la hora planeada para ese punto.
 */
export function buildSchedule(input: {
  firstOpenAt: string | null;
  roundNumber: number;
  status: RoundStatus;
  secondsLeft: number | null;
  durations: PhaseDurations;
  now: Date;
}): ScheduleView {
  const offset = plannedOffsetOf(input.status, input.durations);
  const firstOpen = input.firstOpenAt === null ? Number.NaN : Date.parse(input.firstOpenAt);
  if (offset === null || !Number.isFinite(firstOpen)) {
    return { deltaSeconds: null, plannedAt: null };
  }
  const planned =
    firstOpen + ((input.roundNumber - 1) * roundSeconds(input.durations) + offset) * 1000;
  const projected = input.now.getTime() + (input.secondsLeft ?? 0) * 1000;
  return {
    deltaSeconds: Math.round((projected - planned) / 1000),
    plannedAt: new Date(planned).toISOString(),
  };
}

/** Segundos que restan del cronómetro de una ronda en un instante dado. */
export function secondsLeftOf(round: SnapshotRound, now: Date): number | null {
  if (round.pausedSeconds !== null) return round.pausedSeconds;
  if (round.phaseEndsAt === null) return null;
  return Math.max(0, Math.ceil((Date.parse(round.phaseEndsAt) - now.getTime()) / 1000));
}

/** Startups liquidadas ordenadas por puntaje del jurado. */
export function buildStandings(rounds: readonly SnapshotRound[]): StandingView[] {
  return rounds
    .filter((round) => round.status === "SETTLED" && round.juryScore !== null)
    .map((round) => ({
      roundNumber: round.number,
      startupName: round.startupName,
      juryScore: round.juryScore as number,
      multiplier: round.multiplier,
    }))
    .sort((a, b) => b.juryScore - a.juryScore || a.roundNumber - b.roundNumber);
}

function buildLog(actions: readonly SnapshotAction[]): LogEntryView[] {
  return actions.map((action) => ({
    id: action.id,
    at: action.at.toISOString(),
    time: formatTime(action.at),
    roundNumber: action.roundNumber,
    label: actionLabel(action.action),
    operator: action.operator,
    reason: action.reason,
  }));
}

/** Arma el view model de la consola. Devuelve null cuando el evento no tiene rondas. */
export function buildOperatorView(snapshot: OperatorSnapshot): OperatorViewModel | null {
  const current = referenceRound(snapshot.rounds);
  if (current === undefined) return null;

  const sorted = [...snapshot.rounds].sort((a, b) => a.number - b.number);
  const status = current.status;
  const settled = sorted.filter((round) => round.status === "SETTLED");
  const lastSettled = settled[settled.length - 1];
  const paused = current.pausedSeconds !== null;
  const secondsLeft = secondsLeftOf(current, snapshot.now);
  const timed = status === "OPEN" || status === "LAST_CALL" || status === "VOTING";
  const sent = snapshot.jurors.filter((juror) => juror.sent).length;
  const scored = snapshot.jurors.filter((juror) => juror.sent && !juror.abstains).length;

  return {
    serverTime: snapshot.now.toISOString(),
    operator: snapshot.operator,
    event: {
      started: snapshot.flags.eventStarted,
      manualMode: snapshot.flags.manualMode,
      lastSettledRound:
        lastSettled === undefined
          ? null
          : { number: lastSettled.number, startupName: lastSettled.startupName },
    },
    round: {
      number: current.number,
      total: sorted.length,
      startupName: current.startupName,
      sdg: current.sdg,
      status,
      multiplier: status === "SETTLED" ? current.multiplier : null,
      juryScore: status === "SETTLED" ? current.juryScore : null,
      cancelMode: status === "CANCELLED" || status === "SETTLED" ? snapshot.cancelMode : null,
    },
    rounds: sorted.map((round) => ({
      number: round.number,
      startupName: round.startupName,
      status: round.status,
      multiplier: round.status === "SETTLED" ? round.multiplier : null,
    })),
    mainAction: buildMainAction(status, snapshot.jurors),
    steps: buildSteps(status),
    clock: {
      serverTime: snapshot.now.toISOString(),
      phaseEndsAt: paused ? null : current.phaseEndsAt,
      paused,
      pausedSeconds: current.pausedSeconds,
    },
    timerAdjustable: timed && (paused || current.phaseEndsAt !== null),
    durations: snapshot.durations,
    schedule: buildSchedule({
      firstOpenAt: snapshot.firstOpenAt,
      roundNumber: current.number,
      status,
      secondsLeft,
      durations: snapshot.durations,
      now: snapshot.now,
    }),
    jurors: buildJurors(snapshot.jurors, status),
    market: {
      accumulated: current.accumulated,
      uniqueInvestors: current.uniqueInvestors,
      connectedAttendees: snapshot.attendeesOnline,
      totalAttendees: snapshot.attendeesTotal,
      price: current.price,
    },
    standings: buildStandings(sorted),
    log: buildLog(snapshot.actions),
    canCancel: ACTIVE_ROUND_STATUSES.has(status),
    canRescue: status === "VOTING" && sent < snapshot.jurors.length && scored > 0,
    canManualSettle: status === "CLOSED" || status === "VOTING",
    canCloseEvent: sorted.length > 0 && sorted.every((round) => FINISHED.has(round.status)),
    balances: [...snapshot.balances],
    positions: [...snapshot.positions],
  };
}
