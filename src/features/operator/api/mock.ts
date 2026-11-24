import { EVENT_CONFIG } from "@/shared/domain/config";
import { livePrice } from "@/shared/domain/pricing";
import { countHits, pickWinner } from "@/shared/domain/scoring";
import type { EventCloseSummary } from "@/shared/domain/types";
import { juryFraction, multiplierForScore } from "@/shared/domain/verdict";
import { buildHealth } from "../health";
import { buildSettings, validateCriteria, validateSetting } from "../settings";
import { ACTIVE_ROUND_STATUSES, ATTENDEE_ONLINE_SECONDS } from "../thresholds";
import type {
  AttendeeSearchView,
  AttendeeView,
  CancelMode,
  ConfigUpdate,
  ConfigView,
  CriterionConfigView,
  HealthView,
  OperatorRole,
  OperatorViewModel,
  PositionRow,
  PreflightView,
  RoundStatus,
} from "../types";
import {
  buildOperatorView,
  referenceRound,
  type SnapshotAction,
  type SnapshotJuror,
} from "../view";
import { buildSettlementCsv, downloadCsv } from "./export";

/*
 * Servidor de muestra en memoria para desarrollar la consola con NEXT_PUBLIC_USE_MOCKS=true. Aplica
 * las mismas reglas que la API (rol, transiciones, motivo, bloqueo de la configuración) y arma el
 * view model con el mismo constructor puro (view.ts). La simulación avanza al leer: inversiones con
 * el mercado abierto, cierre automático de la última llamada y envíos de los jurados en la votación.
 * En la ronda 2 el jurado 3 se desconecta, para ensayar la alerta y el rescate (RF-18, RF-26).
 *
 * Códigos de la muestra:
 *   OP-2026      conductor, evento en curso (ronda 2 con el mercado abierto)
 *   SOP-2026     soporte, solo lectura
 *   ENSAYO-2026  conductor, antes del evento (checklist y modo ensayo)
 */

export const MOCK_OPERATOR_CODE = "OP-2026";
export const MOCK_SUPPORT_CODE = "SOP-2026";
export const MOCK_REHEARSAL_CODE = "ENSAYO-2026";

type Raw<T> = { ok: true; data: T } | { ok: false; status: number; code: string | null; offline: boolean };

function ok<T>(data: T): Raw<T> {
  return { ok: true, data };
}

function fail<T = never>(status: number, code: string): Raw<T> {
  return { ok: false, status, code, offline: false };
}

const STARTUPS = [
  { name: "AgroSense", sdg: "ODS 2", description: "Monitoreo de cultivos con sensores de bajo costo." },
  { name: "AguaClara", sdg: "ODS 6", description: "Filtros comunitarios de agua con seguimiento en tiempo real." },
  { name: "EduRuta", sdg: "ODS 4", description: "Rutas de aprendizaje personalizadas para educación básica." },
  { name: "SolRed", sdg: "ODS 7", description: "Microrredes solares para comunidades sin electricidad estable." },
  { name: "SaludCerca", sdg: "ODS 3", description: "Telemedicina de primer contacto para zonas rurales." },
];

/** Notas de los cuatro jurados por ronda. Determinan el puntaje y el multiplicador. */
const JUROR_SCORES = [
  [4.25, 4.0, 3.5, 4.25],
  [4.25, 4.0, 3.5, 4.25],
  [2.5, 3.0, 2.75, 3.25],
  [4.5, 4.25, 4.75, 4.0],
  [2.75, 3.0, 2.5, 3.0],
];

const FIRST_NAMES = [
  "Mariana", "Joaquín", "Valeria", "Andrea", "Renzo", "Diego", "Lucía", "Matías", "Camila",
  "Sebastián", "Fernanda", "Gabriel", "Daniela", "Nicolás", "Paula", "Rodrigo", "Sofía", "Tomás",
];
const LAST_INITIALS = "TRQCAPHVMGSLBDNFEO";

const ATTENDEE_COUNT = 81;
const OFFLINE_ATTENDEES = 3;
/** Cada cuánto invierte un asistente nuevo con el mercado abierto, en milisegundos. */
const INVEST_EVERY_MS = 2_500;
/** Fracción máxima de la sala que invierte en una ronda. */
const MAX_INVESTOR_SHARE = 0.75;
/** Ronda en que el jurado 3 se desconecta durante la votación. */
const DISCONNECT_ROUND = 2;
const DISCONNECT_JUROR = 2;
/** Nombre del conductor de la muestra. */
const CONDUCTOR_NAME = "Diego R.";

interface MockRound {
  number: number;
  status: RoundStatus;
  multiplier: number | null;
  juryScore: number | null;
  phaseEndsAt: number | null;
  pausedSeconds: number | null;
  openedAt: number | null;
  votingStartedAt: number | null;
  cancelMode: CancelMode | null;
  /** Monto invertido por asistente. */
  investments: Map<string, number>;
  /** Retorno liquidado por asistente. */
  returns: Map<string, number>;
}

interface MockAttendee {
  id: string;
  name: string;
  email: string;
  balance: number;
  lastSeenAt: number;
}

interface MockJuror {
  id: string;
  name: string;
  organization: string;
  code: string;
}

interface MockState {
  loggedIn: boolean;
  role: OperatorRole;
  operatorName: string;
  eventStarted: boolean;
  manualMode: boolean;
  settings: Record<string, number>;
  startups: { id: string; order: number; name: string; sdg: string | null; description: string | null; logoUrl: string | null }[];
  rounds: MockRound[];
  jurors: MockJuror[];
  criteria: CriterionConfigView[];
  attendees: MockAttendee[];
  log: SnapshotAction[];
  nextLogId: number;
}

function defaultSettings(): Record<string, number> {
  return {
    capital_inicial: EVENT_CONFIG.initialBalance,
    compra_minima: EVENT_CONFIG.minInvestment,
    tope_ronda: EVENT_CONFIG.roundCapRatio,
    precio_min: EVENT_CONFIG.priceMin,
    precio_max: EVENT_CONFIG.priceMax,
    duracion_pitch_s: EVENT_CONFIG.pitchSeconds,
    duracion_toma_y_dame_s: EVENT_CONFIG.qaSeconds,
    duracion_ultima_llamada_s: EVENT_CONFIG.lastCallSeconds,
    duracion_votacion_s: EVENT_CONFIG.votingSeconds,
    duracion_resultado_s: EVENT_CONFIG.resultSeconds,
    retraso_telefono_s: EVENT_CONFIG.phoneRevealDelayMs / 1000,
  };
}

function newRound(number: number): MockRound {
  return {
    number,
    status: "SCHEDULED",
    multiplier: null,
    juryScore: null,
    phaseEndsAt: null,
    pausedSeconds: null,
    openedAt: null,
    votingStartedAt: null,
    cancelMode: null,
    investments: new Map(),
    returns: new Map(),
  };
}

function freshState(now: number, role: OperatorRole, inEvent: boolean): MockState {
  const settings = defaultSettings();
  const attendees: MockAttendee[] = Array.from({ length: ATTENDEE_COUNT }, (_, index) => {
    const first = FIRST_NAMES[index % FIRST_NAMES.length];
    const initial = LAST_INITIALS[(index * 7) % LAST_INITIALS.length];
    return {
      id: String(index + 1),
      name: `${first} ${initial}.`,
      email: `${first.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")}.${index + 1}@uni.pe`,
      balance: settings.capital_inicial,
      lastSeenAt: index < ATTENDEE_COUNT - OFFLINE_ATTENDEES ? now : now - 5 * 60_000,
    };
  });

  const state: MockState = {
    loggedIn: false,
    role,
    operatorName: role === "CONDUCTOR" ? CONDUCTOR_NAME : "Soporte 1",
    eventStarted: false,
    manualMode: false,
    settings,
    startups: STARTUPS.map((startup, index) => ({
      id: String(index + 1),
      order: index + 1,
      name: startup.name,
      sdg: startup.sdg,
      description: startup.description,
      logoUrl: null,
    })),
    rounds: STARTUPS.map((_, index) => newRound(index + 1)),
    jurors: [
      { id: "1", name: "Jurado 1", organization: "Incubadora UNI", code: "JUR-4821" },
      { id: "2", name: "Jurado 2", organization: "Docente FIIS", code: "JUR-1907" },
      { id: "3", name: "Jurado 3", organization: "Fondo de impacto", code: "JUR-3355" },
      { id: "4", name: "Jurado 4", organization: "Hult Prize", code: "JUR-6610" },
    ],
    criteria: [
      { id: "1", name: "Problema y mercado", weight: 0.25, anchorMin: "No hay evidencia del problema.", anchorMax: "Problema validado con clientes." },
      { id: "2", name: "Modelo de negocio", weight: 0.25, anchorMin: "No se sabe quién paga.", anchorMax: "Ingresos claros y probados." },
      { id: "3", name: "Impacto ODS", weight: 0.25, anchorMin: "Impacto difuso.", anchorMax: "Impacto medible y escalable." },
      { id: "4", name: "Equipo y pitch", weight: 0.25, anchorMin: "Equipo incompleto.", anchorMax: "Equipo sólido y pitch claro." },
    ],
    attendees,
    log: [],
    nextLogId: 1,
  };

  if (inEvent) {
    state.eventStarted = true;
    const roundSeconds = roundTotalSeconds(settings);
    const pitchLeft = 161;
    // Ronda 1 liquidada; ronda 2 con el mercado abierto y el evento 3 minutos atrasado.
    const round2Opened = now - (settings.duracion_pitch_s - pitchLeft) * 1000;
    const round1Opened = round2Opened - (roundSeconds + 180) * 1000;
    const r1 = state.rounds[0];
    r1.openedAt = round1Opened;
    r1.status = "OPEN";
    simulateInvestments(state, r1, round1Opened + 120_000);
    settleRound(state, r1, averageScore(JUROR_SCORES[0]));
    log(state, round1Opened, 1, "OPEN", null);
    log(state, round1Opened + 900_000, 1, "LAST_CALL", null);
    log(state, round1Opened + 960_000, 1, "CLOSE", null);
    log(state, round1Opened + 965_000, 1, "ENABLE_VOTING", null);
    log(state, round1Opened + 1_100_000, 1, "REVEAL", null);

    const r2 = state.rounds[1];
    r2.status = "OPEN";
    r2.openedAt = round2Opened;
    r2.phaseEndsAt = now + (pitchLeft + settings.duracion_toma_y_dame_s) * 1000;
    log(state, round2Opened, 2, "OPEN", null);
  }
  return state;
}

function roundTotalSeconds(settings: Record<string, number>): number {
  return (
    settings.duracion_pitch_s +
    settings.duracion_toma_y_dame_s +
    settings.duracion_ultima_llamada_s +
    settings.duracion_votacion_s +
    settings.duracion_resultado_s
  );
}

function averageScore(scores: readonly number[]): number {
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function log(
  state: MockState,
  at: number,
  roundNumber: number,
  action: string,
  reason: string | null,
): void {
  state.log.unshift({
    id: String(state.nextLogId++),
    at: new Date(at),
    roundNumber,
    action,
    // Solo el conductor ejecuta acciones; con la sesión de soporte el historial es del conductor.
    operator: state.role === "CONDUCTOR" ? state.operatorName : CONDUCTOR_NAME,
    reason,
  });
}

/** Monto que invierte el asistente de la posición indicada: entre 250 y el tope de la ronda. */
function investmentAmount(state: MockState, attendee: MockAttendee, index: number): number {
  const cap = Math.floor(attendee.balance * state.settings.tope_ronda);
  const amount = 250 + ((index * 997) % 12) * 250;
  return Math.max(0, Math.min(cap, amount));
}

/** Simula las inversiones de la ronda abierta hasta el instante indicado. */
function simulateInvestments(state: MockState, round: MockRound, now: number): void {
  if (round.openedAt === null || round.pausedSeconds !== null) return;
  const target = Math.min(
    Math.floor(state.attendees.length * MAX_INVESTOR_SHARE),
    Math.floor((now - round.openedAt) / INVEST_EVERY_MS),
  );
  let index = round.investments.size;
  while (round.investments.size < target && index < state.attendees.length * 2) {
    const attendee = state.attendees[(index * 13 + round.number * 5) % state.attendees.length];
    index += 1;
    if (round.investments.has(attendee.id)) continue;
    const amount = investmentAmount(state, attendee, index);
    if (amount < state.settings.compra_minima) continue;
    attendee.balance -= amount;
    round.investments.set(attendee.id, amount);
  }
}

function accumulatedOf(round: MockRound): number {
  let total = 0;
  for (const amount of round.investments.values()) total += amount;
  return total;
}

function priceOf(state: MockState, round: MockRound): number {
  const price = livePrice(accumulatedOf(round));
  return Math.min(state.settings.precio_max, Math.max(state.settings.precio_min, price));
}

function settleRound(state: MockState, round: MockRound, score: number): void {
  const multiplier = multiplierForScore(score);
  for (const [attendeeId, amount] of round.investments) {
    const payout = Math.round(amount * multiplier * 100) / 100;
    round.returns.set(attendeeId, payout);
    const attendee = state.attendees.find((item) => item.id === attendeeId);
    if (attendee !== undefined) attendee.balance += payout;
  }
  round.status = "SETTLED";
  round.multiplier = multiplier;
  round.juryScore = score;
  round.phaseEndsAt = null;
  round.pausedSeconds = null;
}

function refundRound(state: MockState, round: MockRound, mode: CancelMode): void {
  for (const [attendeeId, amount] of round.investments) {
    round.returns.set(attendeeId, amount);
    const attendee = state.attendees.find((item) => item.id === attendeeId);
    if (attendee !== undefined) attendee.balance += amount;
  }
  round.status = mode === "refund" ? "CANCELLED" : "SETTLED";
  round.multiplier = 1;
  round.juryScore = null;
  round.cancelMode = mode;
  round.phaseEndsAt = null;
  round.pausedSeconds = null;
}

/** Envío simulado de un jurado en la votación. */
interface MockVote {
  sent: boolean;
  drafting: boolean;
  score: number;
  lastSeenAt: number | null;
}

function jurorVote(round: MockRound, jurorIndex: number, now: number): MockVote {
  const score = JUROR_SCORES[(round.number - 1) % JUROR_SCORES.length][jurorIndex];
  if (round.status === "SETTLED" || round.status === "CANCELLED") {
    return { sent: round.juryScore !== null, drafting: false, score, lastSeenAt: now };
  }
  if (round.status !== "VOTING" || round.votingStartedAt === null) {
    return { sent: false, drafting: round.status === "CLOSED", score, lastSeenAt: now };
  }
  const elapsed = now - round.votingStartedAt;
  if (round.number === DISCONNECT_ROUND && jurorIndex === DISCONNECT_JUROR) {
    return { sent: false, drafting: true, score, lastSeenAt: round.votingStartedAt + 2_000 };
  }
  return {
    sent: elapsed >= 6_000 * (jurorIndex + 1),
    drafting: elapsed >= 1_500 * (jurorIndex + 1),
    score,
    lastSeenAt: now,
  };
}

/** Avanza la simulación hasta el instante indicado. */
function advance(state: MockState, now: number): void {
  // Los teléfonos conectados siguen consultando; los últimos de la lista quedaron sin conexión.
  state.attendees.forEach((attendee, index) => {
    if (index < state.attendees.length - OFFLINE_ATTENDEES) attendee.lastSeenAt = now;
  });
  for (const round of state.rounds) {
    if (round.status === "OPEN" || round.status === "LAST_CALL") {
      simulateInvestments(state, round, now);
    }
    // Cierre automático de la última llamada vencida (RF-08).
    if (
      round.status === "LAST_CALL" &&
      round.pausedSeconds === null &&
      round.phaseEndsAt !== null &&
      round.phaseEndsAt <= now
    ) {
      round.status = "CLOSED";
      round.phaseEndsAt = null;
    }
  }
}

let state: MockState = freshState(Date.now(), "CONDUCTOR", true);

function current(): MockRound | undefined {
  return referenceRound(state.rounds);
}

function snapshotJurors(round: MockRound | undefined, now: number): SnapshotJuror[] {
  return state.jurors.map((juror, index) => {
    const vote = round === undefined ? null : jurorVote(round, index, now);
    return {
      id: juror.id,
      name: juror.name,
      sent: vote?.sent ?? false,
      abstains: false,
      drafting: vote?.drafting ?? false,
      score: vote?.score ?? null,
      secondsSinceSeen: vote?.lastSeenAt == null ? 0 : (now - vote.lastSeenAt) / 1000,
    };
  });
}

function onlineCount(now: number): number {
  return state.attendees.filter((item) => now - item.lastSeenAt < ATTENDEE_ONLINE_SECONDS * 1000)
    .length;
}

function positions(): PositionRow[] {
  const rows: PositionRow[] = [];
  for (const round of state.rounds) {
    const startup = state.startups[round.number - 1];
    for (const [attendeeId, amount] of round.investments) {
      const attendee = state.attendees.find((item) => item.id === attendeeId);
      rows.push({
        attendeeId,
        attendeeName: attendee?.name ?? attendeeId,
        round: round.number,
        startupName: startup.name,
        amount,
        returnAmount: round.returns.get(attendeeId) ?? null,
      });
    }
  }
  return rows;
}

function viewModel(now: number): OperatorViewModel | null {
  advance(state, now);
  const reference = current();
  const first = state.rounds.find((round) => round.number === 1);
  return buildOperatorView({
    now: new Date(now),
    operator: { name: state.operatorName, role: state.role },
    flags: { eventStarted: state.eventStarted, manualMode: state.manualMode },
    durations: {
      pitch: state.settings.duracion_pitch_s,
      qa: state.settings.duracion_toma_y_dame_s,
      lastCall: state.settings.duracion_ultima_llamada_s,
      voting: state.settings.duracion_votacion_s,
      result: state.settings.duracion_resultado_s,
    },
    rounds: state.rounds.map((round) => ({
      number: round.number,
      startupName: state.startups[round.number - 1].name,
      sdg: state.startups[round.number - 1].sdg,
      status: round.status,
      multiplier: round.multiplier,
      juryScore: round.juryScore,
      phaseEndsAt: round.phaseEndsAt === null ? null : new Date(round.phaseEndsAt).toISOString(),
      pausedSeconds: round.pausedSeconds,
      accumulated: accumulatedOf(round),
      uniqueInvestors: round.investments.size,
      price: priceOf(state, round),
    })),
    firstOpenAt:
      first === undefined || first.openedAt === null ? null : new Date(first.openedAt).toISOString(),
    jurors: snapshotJurors(reference, now),
    cancelMode: reference?.cancelMode ?? null,
    attendeesOnline: onlineCount(now),
    attendeesTotal: state.attendees.length,
    actions: state.log,
    balances: state.attendees.map((attendee) => ({
      attendeeId: attendee.id,
      attendeeName: attendee.name,
      balance: attendee.balance,
    })),
    positions: positions(),
  });
}

function requireSession(): Raw<never> | null {
  return state.loggedIn ? null : fail(401, "INVALID_SESSION");
}

function requireConductor(): Raw<never> | null {
  return requireSession() ?? (state.role === "CONDUCTOR" ? null : fail(403, "FORBIDDEN"));
}

function seconds(key: string): number {
  return state.settings[key];
}

/** Ejecuta una acción de ronda con las reglas de fn_accion_operador y fn_revelar_veredicto. */
function runAction(action: string, reason: string | null, now: number): Raw<{ ok: true; multiplier: number | null }> {
  advance(state, now);
  const active = state.rounds.find((round) => ACTIVE_ROUND_STATUSES.has(round.status));
  const pending = state.rounds.find((round) => round.status === "SCHEDULED");
  const round = action === "OPEN" ? pending : active;
  if (round === undefined) return fail(409, "ROUND_UNAVAILABLE");
  const done = (multiplier: number | null = null) => {
    log(state, now, round.number, action, reason);
    return ok({ ok: true as const, multiplier });
  };

  switch (action) {
    case "OPEN": {
      if (active !== undefined) return fail(409, "ANOTHER_ROUND_ACTIVE");
      round.status = "OPEN";
      round.openedAt = now;
      round.phaseEndsAt = now + (seconds("duracion_pitch_s") + seconds("duracion_toma_y_dame_s")) * 1000;
      return done();
    }
    case "LAST_CALL":
      if (round.status !== "OPEN") return fail(409, "TRANSITION_NOT_ALLOWED");
      round.status = "LAST_CALL";
      round.pausedSeconds = null;
      round.phaseEndsAt = now + seconds("duracion_ultima_llamada_s") * 1000;
      return done();
    case "CLOSE":
      if (round.status !== "OPEN" && round.status !== "LAST_CALL") {
        return fail(409, "TRANSITION_NOT_ALLOWED");
      }
      round.status = "CLOSED";
      round.phaseEndsAt = null;
      round.pausedSeconds = null;
      return done();
    case "ENABLE_VOTING":
      if (round.status !== "CLOSED") return fail(409, "TRANSITION_NOT_ALLOWED");
      round.status = "VOTING";
      round.votingStartedAt = now;
      round.phaseEndsAt = now + seconds("duracion_votacion_s") * 1000;
      return done();
    case "PAUSE": {
      if (!["OPEN", "LAST_CALL", "VOTING"].includes(round.status)) {
        return fail(409, "TRANSITION_NOT_ALLOWED");
      }
      if (round.pausedSeconds !== null) return fail(409, "ALREADY_PAUSED");
      if (round.phaseEndsAt === null) return fail(409, "NO_TIMER");
      round.pausedSeconds = Math.max(0, Math.ceil((round.phaseEndsAt - now) / 1000));
      round.phaseEndsAt = null;
      return done();
    }
    case "RESUME":
      if (round.pausedSeconds === null) return fail(409, "NOT_PAUSED");
      round.phaseEndsAt = now + round.pausedSeconds * 1000;
      round.pausedSeconds = null;
      return done();
    case "ADD_MINUTE":
      if (!["OPEN", "LAST_CALL", "VOTING"].includes(round.status)) {
        return fail(409, "TRANSITION_NOT_ALLOWED");
      }
      if (round.pausedSeconds !== null) round.pausedSeconds += 60;
      else if (round.phaseEndsAt !== null) round.phaseEndsAt += 60_000;
      else return fail(409, "NO_TIMER");
      return done();
    case "REVEAL": {
      if (round.status !== "VOTING") return fail(409, "ROUND_NOT_VOTING");
      const votes = state.jurors.map((_, index) => jurorVote(round, index, now));
      const sent = votes.filter((vote) => vote.sent);
      if (sent.length < votes.length) {
        if (reason === null) return fail(409, "PENDING_VOTES");
      }
      if (sent.length === 0) return fail(409, "NO_VOTES_CAST");
      const score = averageScore(sent.map((vote) => vote.score));
      settleRound(state, round, score);
      log(state, now, round.number, sent.length < votes.length ? "REVELAR_PRESENTES" : "REVEAL", reason);
      return ok({ ok: true as const, multiplier: round.multiplier });
    }
    case "CANCEL_REFUND":
    case "CANCEL_SETTLE_1X":
      if (reason === null) return fail(409, "REASON_REQUIRED");
      refundRound(state, round, action === "CANCEL_REFUND" ? "refund" : "settle_1x");
      return done(1);
    default:
      return fail(400, "INVALID_ACTION");
  }
}

function configView(): ConfigView {
  return {
    locked: state.rounds.some((round) => ACTIVE_ROUND_STATUSES.has(round.status)),
    settings: buildSettings(state.settings),
    startups: state.startups.map((startup) => ({ ...startup })),
    jurors: state.jurors.map((juror) => ({
      id: juror.id,
      name: juror.name,
      organization: juror.organization,
      accessCode: state.role === "CONDUCTOR" ? juror.code : null,
    })),
    criteria: state.criteria.map((criterion) => ({ ...criterion })),
  };
}

function preflightView(): PreflightView {
  const rounds = state.rounds;
  const items = [
    { id: "startups", label: "5 startups cargadas con su ronda", detail: `${state.startups.length} startups y ${rounds.length} rondas.`, ok: state.startups.length === 5 && rounds.length === 5 },
    { id: "jurors", label: "4 jurados con código", detail: state.jurors.map((juror) => juror.code).join(", "), ok: state.jurors.length === 4 },
    { id: "db", label: "Base de datos respondiendo", detail: "Latencia promedio 180 ms.", ok: true },
    { id: "login", label: "Login con Google respondiendo", detail: "Neon Auth respondió en 210 ms.", ok: true },
    { id: "criteria", label: "4 criterios con pesos que suman 100%", detail: `${state.criteria.length} criterios.`, ok: validateCriteria(state.criteria) === null },
    {
      id: "rounds",
      label: "Rondas sin abrir",
      detail: `${rounds.filter((round) => round.status === "SCHEDULED").length} de ${rounds.length} programadas.`,
      ok: state.eventStarted || rounds.every((round) => round.status === "SCHEDULED"),
    },
    { id: "conductor", label: "Al menos un conductor", detail: "1 conductor.", ok: true },
  ];
  return { ready: items.every((item) => item.ok), eventStarted: state.eventStarted, items };
}

function attendeeViews(now: number): AttendeeView[] {
  const invested = new Map<string, number>();
  for (const round of state.rounds) {
    for (const [attendeeId, amount] of round.investments) {
      if (!round.returns.has(attendeeId)) {
        invested.set(attendeeId, (invested.get(attendeeId) ?? 0) + amount);
      }
    }
  }
  const ranked = [...state.attendees]
    .map((attendee) => ({ attendee, value: attendee.balance + (invested.get(attendee.id) ?? 0) }))
    .sort((a, b) => b.value - a.value || Number(a.attendee.id) - Number(b.attendee.id));

  return ranked.map(({ attendee, value }) => {
    const position = ranked.findIndex((item) => item.value === value) + 1;
    const lastRound = [...state.rounds].reverse().find((round) => round.investments.has(attendee.id));
    const seen = (now - attendee.lastSeenAt) / 1000;
    return {
      id: attendee.id,
      name: attendee.name,
      email: attendee.email,
      balance: attendee.balance,
      position,
      online: seen < ATTENDEE_ONLINE_SECONDS,
      lastSeenSeconds: Math.floor(seen),
      lastInvestment:
        lastRound === undefined
          ? null
          : {
              roundNumber: lastRound.number,
              startupName: state.startups[lastRound.number - 1].name,
              amount: lastRound.investments.get(attendee.id) ?? 0,
            },
    };
  });
}

function closeSummary(now: number): EventCloseSummary {
  const total = state.attendees.length;
  const standings = state.rounds
    .filter((round) => round.status === "SETTLED" && round.juryScore !== null)
    .map((round) => ({
      id: String(round.number),
      name: state.startups[round.number - 1].name,
      juryScore: round.juryScore as number,
      fraction: juryFraction(round.juryScore as number),
      investorPct: total === 0 ? 0 : round.investments.size / total,
    }));
  const winner = pickWinner(standings);

  const hitsOf = (attendeeId: string) =>
    countHits(
      state.rounds
        .filter((round) => round.multiplier !== null && round.investments.has(attendeeId))
        .map((round) => round.multiplier as number),
    );
  const top = [...state.attendees].sort((a, b) => b.balance - a.balance).slice(0, 3);
  const best = [...state.attendees]
    .map((attendee) => ({ attendee, hits: hitsOf(attendee.id) }))
    .sort((a, b) => b.hits - a.hits)[0];

  return {
    closedAt: new Date(now).toISOString(),
    winnerStartup:
      winner === undefined
        ? null
        : {
            name: winner.name,
            juryScore: winner.juryScore,
            investorShare: winner.investorPct,
            finalScore:
              EVENT_CONFIG.winnerWeightJury * winner.fraction +
              EVENT_CONFIG.winnerWeightTraction * winner.investorPct,
          },
    topInvestors: top.map((attendee) => ({
      name: attendee.name,
      balance: attendee.balance,
      hits: hitsOf(attendee.id),
    })),
    bestEye: best === undefined ? null : { name: best.attendee.name, hits: best.hits },
  };
}

/** Servidor de muestra con la misma forma que la API. */
export const mockServer = {
  login(code: string): Raw<{ ok: boolean; name: string }> {
    const normalized = code.trim().toUpperCase();
    const now = Date.now();
    if (normalized === MOCK_OPERATOR_CODE) state = freshState(now, "CONDUCTOR", true);
    else if (normalized === MOCK_SUPPORT_CODE) state = freshState(now, "SUPPORT", true);
    else if (normalized === MOCK_REHEARSAL_CODE) state = freshState(now, "CONDUCTOR", false);
    else if (normalized === "") return fail(400, "CODE_REQUIRED");
    else return fail(401, "INVALID_CODE");
    state.loggedIn = true;
    return ok({ ok: true, name: state.operatorName });
  },

  logout(): void {
    state.loggedIn = false;
  },

  state(now = Date.now()): Raw<OperatorViewModel> {
    const denied = requireSession();
    if (denied) return denied;
    const view = viewModel(now);
    return view === null ? fail(404, "NO_ROUNDS") : ok(view);
  },

  action(action: string, reason: string | null, now = Date.now()) {
    return requireConductor() ?? runAction(action, reason, now);
  },

  manualSettlement(score: number, reason: string, now = Date.now()): Raw<{ ok: boolean; multiplicador: number }> {
    const denied = requireConductor();
    if (denied) return denied;
    advance(state, now);
    const round = state.rounds.find((item) => item.status === "CLOSED" || item.status === "VOTING");
    if (round === undefined) return fail(409, "RONDA_NO_DISPONIBLE");
    if (!(score >= 1 && score <= 5)) return fail(400, "PUNTAJE_INVALIDO");
    if (reason.trim() === "") return fail(400, "MOTIVO_REQUERIDO");
    settleRound(state, round, score);
    log(state, now, round.number, "REVELAR_MANUAL", reason);
    return ok({ ok: true, multiplicador: round.multiplier as number });
  },

  health(now = Date.now()): Raw<HealthView> {
    const denied = requireSession();
    if (denied) return denied;
    advance(state, now);
    const reference = current();
    return ok(
      buildHealth({
        now: new Date(now),
        dbLatencyMs: 140 + (Math.floor(now / 1000) % 5) * 15,
        attendeesOnline: onlineCount(now),
        attendeesTotal: state.attendees.length,
        jurors: snapshotJurors(reference, now).map((juror) => ({
          id: juror.id,
          name: juror.name,
          secondsSinceSeen: juror.secondsSinceSeen,
          sent: juror.sent,
        })),
        round: reference === undefined ? null : { number: reference.number, status: reference.status },
      }),
    );
  },

  attendees(query: string, now = Date.now()): Raw<AttendeeSearchView> {
    const denied = requireSession();
    if (denied) return denied;
    advance(state, now);
    const needle = query.trim().toLowerCase();
    const items = attendeeViews(now)
      .filter(
        (item) =>
          needle === "" ||
          item.name.toLowerCase().includes(needle) ||
          (item.email ?? "").toLowerCase().includes(needle),
      )
      .slice(0, 20);
    return ok({ items, online: onlineCount(now), total: state.attendees.length });
  },

  balance(userId: string, amount: number, reason: string, now = Date.now()): Raw<{ ok: boolean; balance: number | null }> {
    const denied = requireConductor();
    if (denied) return denied;
    if (reason.trim() === "") return fail(400, "REASON_REQUIRED");
    if (!Number.isFinite(amount) || amount === 0) return fail(400, "INVALID_BODY");
    const attendee = state.attendees.find((item) => item.id === userId);
    if (attendee === undefined) return fail(409, "USER_NOT_FOUND");
    if (attendee.balance + amount < 0) return fail(409, "NEGATIVE_BALANCE");
    attendee.balance += amount;
    const round = referenceRound(state.rounds);
    log(state, now, round?.number ?? 1, "AJUSTE_SALDO", `usuario ${userId}, ${amount} IC: ${reason}`);
    return ok({ ok: true, balance: attendee.balance });
  },

  manualMode(enabled: boolean, reason: string | null, now = Date.now()): Raw<{ ok: boolean }> {
    const denied = requireConductor();
    if (denied) return denied;
    state.manualMode = enabled;
    const round = referenceRound(state.rounds);
    log(state, now, round?.number ?? 1, enabled ? "MODO_MANUAL_ON" : "MODO_MANUAL_OFF", reason);
    return ok({ ok: true });
  },

  config(): Raw<ConfigView> {
    return requireSession() ?? ok(configView());
  },

  updateConfig(update: ConfigUpdate, now = Date.now()): Raw<{ ok: boolean }> {
    const denied = requireConductor();
    if (denied) return denied;
    advance(state, now);
    if (configView().locked) return fail(409, "ROUND_OPEN");
    const round = referenceRound(state.rounds)?.number ?? 1;
    switch (update.kind) {
      case "setting": {
        const error = validateSetting(update.key, update.value, state.settings);
        if (error !== null) return fail(400, error);
        log(state, now, round, "CONFIGURACION", `${update.key}: ${state.settings[update.key]} → ${update.value}`);
        state.settings[update.key] = update.value;
        break;
      }
      case "startup": {
        const startup = state.startups.find((item) => item.id === update.id);
        if (startup === undefined) return fail(404, "NOT_FOUND");
        if (update.name.trim() === "") return fail(400, "INVALID_BODY");
        Object.assign(startup, {
          name: update.name.trim(),
          sdg: update.sdg,
          description: update.description,
          logoUrl: update.logoUrl,
        });
        log(state, now, round, "CONFIGURACION", `Startup ${update.id}: ${startup.name}`);
        break;
      }
      case "juror": {
        const juror = state.jurors.find((item) => item.id === update.id);
        if (juror === undefined) return fail(404, "NOT_FOUND");
        if (update.name.trim() === "" || update.accessCode.trim() === "") {
          return fail(400, "INVALID_BODY");
        }
        if (state.jurors.some((item) => item.id !== update.id && item.code === update.accessCode.trim())) {
          return fail(409, "CODE_TAKEN");
        }
        Object.assign(juror, {
          name: update.name.trim(),
          organization: update.organization ?? "",
          code: update.accessCode.trim(),
        });
        log(state, now, round, "CONFIGURACION", `Jurado ${update.id}: ${juror.name}`);
        break;
      }
      case "criteria": {
        const error = validateCriteria(update.items);
        if (error !== null) return fail(400, error);
        state.criteria = update.items.map((item) => ({ ...item }));
        log(state, now, round, "CONFIGURACION", "Criterios del jurado");
        break;
      }
    }
    return ok({ ok: true });
  },

  preflight(): Raw<PreflightView> {
    return requireSession() ?? ok(preflightView());
  },

  startEvent(now = Date.now()): Raw<{ ok: boolean }> {
    const denied = requireConductor();
    if (denied) return denied;
    const preflight = preflightView();
    if (preflight.eventStarted) return fail(409, "EVENT_ALREADY_STARTED");
    if (!preflight.ready) return fail(409, "PREFLIGHT_NOT_READY");
    state.eventStarted = true;
    log(state, now, 1, "INICIAR_EVENTO", null);
    return ok({ ok: true });
  },

  rehearsal(now = Date.now()): Raw<{ ok: boolean }> {
    const denied = requireConductor();
    if (denied) return denied;
    if (state.eventStarted) return fail(409, "EVENT_STARTED");
    const fresh = freshState(now, state.role, false);
    fresh.loggedIn = true;
    fresh.settings = state.settings;
    fresh.startups = state.startups;
    fresh.jurors = state.jurors;
    fresh.criteria = state.criteria;
    for (const attendee of fresh.attendees) attendee.balance = state.settings.capital_inicial;
    state = fresh;
    return ok({ ok: true });
  },

  closeEvent(now = Date.now()): Raw<EventCloseSummary> {
    const denied = requireConductor();
    if (denied) return denied;
    advance(state, now);
    if (state.rounds.some((round) => round.status !== "SETTLED" && round.status !== "CANCELLED")) {
      return fail(409, "ROUNDS_PENDING");
    }
    return ok(closeSummary(now));
  },

  downloadCsv(now = Date.now()): void {
    const view = viewModel(now);
    if (view === null) return;
    downloadCsv(`saldos-posiciones-ronda-${view.round.number}.csv`, buildSettlementCsv(view));
  },

  /** Reinicia la muestra. Solo para pruebas. */
  reset(now = Date.now()): void {
    state = freshState(now, "CONDUCTOR", true);
  },
};
