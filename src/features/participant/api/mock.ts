import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { isHit as isHitMultiplier } from "@/shared/domain/scoring";
import { juryFraction, multiplierForScore } from "@/shared/domain/verdict";
import { MARKET_CLOSED_MESSAGE, describeInvestmentIssue } from "../messages";
import { formatCoins } from "../format";
import { getInvestmentIssue, getMarketPrice, getRoundCap } from "../rules";
import type {
  AnnulmentMode,
  ParticipantActions,
  ParticipantPhase,
  ParticipantViewModel,
  InvestmentResult,
  RoundSummary,
  StandingEntry,
  StandingInfo,
  StartupInfo,
  UseParticipantStateResult,
  VerdictInfo,
} from "../types";

/*
 * Simulación del estado del inversionista. Devuelve la forma que tendrá la API real
 * (ParticipantViewModel) con datos de ejemplo y transiciones de tiempo fijo. Se activa solo con
 * NEXT_PUBLIC_USE_MOCKS=true, mediante el despachador de hooks/useParticipantState.ts.
 */

const TOTAL_ROUNDS = 5;
const PARTICIPANTS = 74;
/** Posición de referencia: el saldo inicial equivale al puesto 40. */
const REFERENCE_POSITION = 40;
const COINS_PER_POSITION = 150;

/** Duración simulada de cada fase, en milisegundos. La última llamada usa el conteo configurado. */
const PHASE_DURATION_MS: Partial<Record<ParticipantPhase, number>> = {
  scheduled: 8_000,
  open: 25_000,
  voting: 8_000,
  result: 12_000,
};
const ROOM_TICK_MS = 3_000;
const ROOM_MIN_COINS = 250;
const ROOM_RANGE_COINS = 1_800;
const MAX_INVESTORS = 70;

const DEMO_DESCRIPTION = "Startup de ejemplo para la demostración.";
const STARTUPS: StartupInfo[] = [
  { name: "Aurora Agro", sdg: "ODS 2 · Hambre cero", description: DEMO_DESCRIPTION, logoUrl: null },
  { name: "Nodo Solar", sdg: "ODS 7 · Energía asequible", description: DEMO_DESCRIPTION, logoUrl: null },
  { name: "Aqua Lima", sdg: "ODS 6 · Agua limpia", description: DEMO_DESCRIPTION, logoUrl: null },
  { name: "Tejido Vivo", sdg: "ODS 12 · Producción responsable", description: DEMO_DESCRIPTION, logoUrl: null },
  { name: "Ruta Verde", sdg: "ODS 11 · Ciudades sostenibles", description: DEMO_DESCRIPTION, logoUrl: null },
];

/** Puntaje promedio simulado del jurado por ronda, de 1 a 5. */
const ROUND_SCORES = [4, 3.75, 5, 1.75, 4.25];
/** Startup ganadora de la demostración: la de mejor puntaje. */
const DEMO_WINNER = STARTUPS[2].name;

/**
 * Anulaciones simuladas por índice de ronda. La ronda 4 se anula con devolución para mostrar el
 * estado de anulación en la demostración.
 */
const ROUND_ANNULMENTS: Partial<Record<number, AnnulmentMode>> = { 3: "refund" };

const TOP_NAMES = ["Sofía Mendoza", "Carlos Ruiz", "Lucía Paredes"];

/** Resultado simulado de una ronda ya terminada. */
interface SettledRound {
  invested: number;
  payout: number;
  multiplier: number;
  annulment: AnnulmentMode | null;
  settledAt: string;
}

interface MockState {
  phase: ParticipantPhase;
  /** Índice de la ronda en curso, desde 0. */
  roundIndex: number;
  balance: number;
  /** Saldo al abrir la ronda; define el tope de inversión. */
  roundStartBalance: number;
  invested: number;
  raised: number;
  investors: number;
  countdown: number;
  /** Hora en que cierra el mercado abierto, en milisegundos. */
  openEndsAt: number;
  position: number;
  previousPosition: number;
  hits: number;
  /** Rondas terminadas, en orden. Su longitud es el número de rondas evaluadas. */
  settled: SettledRound[];
}

/**
 * Parámetro de URL que muestra la pantalla de ingreso en la simulación. Sin él, la simulación
 * arranca con una sesión activa en la fase programada, como un asistente que ya ingresó.
 */
const SIGN_IN_PARAM = "sesion";
const SIGN_IN_PARAM_VALUE = "ingreso";

const INITIAL_STATE: MockState = {
  phase: "scheduled",
  roundIndex: 0,
  balance: EVENT_CONFIG.initialBalance,
  roundStartBalance: EVENT_CONFIG.initialBalance,
  invested: 0,
  raised: 0,
  investors: 0,
  countdown: EVENT_CONFIG.lastCallSeconds,
  openEndsAt: 0,
  position: REFERENCE_POSITION,
  previousPosition: REFERENCE_POSITION,
  hits: 0,
  settled: [],
};

function positionFor(balance: number): number {
  const raw = REFERENCE_POSITION - (balance - EVENT_CONFIG.initialBalance) / COINS_PER_POSITION;
  return Math.min(PARTICIPANTS, Math.max(1, Math.round(raw)));
}

function balanceForPosition(position: number): number {
  return EVENT_CONFIG.initialBalance + (REFERENCE_POSITION - position) * COINS_PER_POSITION;
}

/** Veredicto simulado. Con anulación, el multiplicador es 1.0x y el retorno iguala lo invertido. */
function computeVerdict(roundIndex: number, settled: SettledRound): VerdictInfo {
  const score = settled.annulment === null ? ROUND_SCORES[roundIndex] : null;
  return {
    juryScore: score,
    scorePct: score === null ? null : Math.round(juryFraction(score) * 100),
    multiplier: settled.multiplier,
    invested: settled.invested,
    payout: settled.payout,
    gain: settled.payout - settled.invested,
    annulment: settled.annulment,
    settledAt: settled.settledAt,
  };
}

/** Aciertos seguidos en las últimas rondas en que invirtió. */
function streakOf(settled: readonly SettledRound[]): number {
  let streak = 0;
  for (const round of [...settled].reverse()) {
    if (round.invested === 0) continue;
    if (round.annulment !== null || !isHitMultiplier(round.multiplier)) break;
    streak += 1;
  }
  return streak;
}

function entry(position: number, name: string, previousPosition: number | null): StandingEntry {
  return { position, name, balance: balanceForPosition(position), isCurrent: false, previousPosition };
}

function buildStanding(s: MockState): StandingInfo {
  const me: StandingEntry = {
    position: s.position,
    name: "Tú",
    balance: s.balance,
    isCurrent: true,
    previousPosition: s.previousPosition,
  };
  const topThree = TOP_NAMES.map((name, index) => entry(index + 1, name, index + 1));
  const window: StandingEntry[] = [];
  for (let position = Math.max(1, s.position - 2); position <= Math.min(PARTICIPANTS, s.position + 2); position += 1) {
    window.push(position === s.position ? me : entry(position, `Asistente ${position}`, position));
  }
  return {
    position: s.position,
    previousPosition: s.previousPosition,
    participants: PARTICIPANTS,
    hits: s.hits,
    hitsTotal: s.settled.length,
    streak: streakOf(s.settled),
    topThree,
    window,
    distanceToFirst: Math.max(0, balanceForPosition(1) - s.balance),
    distanceToPodium: s.position <= 3 ? 0 : Math.max(0, balanceForPosition(3) - s.balance),
    me,
  };
}

/** Resumen de las rondas del evento: estado, monto invertido y ganancia de cada una. */
function buildRounds(s: MockState): RoundSummary[] {
  return STARTUPS.map((startup, index) => {
    const settled = s.settled[index];
    if (settled !== undefined) {
      return {
        number: index + 1,
        startupName: startup.name,
        state: settled.annulment !== null ? "annulled" : "settled",
        invested: settled.invested,
        gain: settled.payout - settled.invested,
      };
    }
    const isCurrent = index === s.roundIndex;
    return {
      number: index + 1,
      startupName: startup.name,
      state: isCurrent ? "current" : "pending",
      invested: isCurrent ? s.invested : 0,
      gain: null,
    };
  });
}

function deriveViewModel(s: MockState): ParticipantViewModel {
  if (s.phase === "login") {
    return {
      phase: s.phase,
      round: null,
      startup: null,
      wallet: null,
      market: null,
      clock: null,
      verdict: null,
      standing: null,
      rounds: [],
      winnerStartup: null,
    };
  }

  const isMarketOpen = s.phase === "open" || s.phase === "lastCall";
  const isRevealed = s.phase === "result" || s.phase === "final";
  const lastSettled = s.settled[s.settled.length - 1];

  return {
    phase: s.phase,
    round: { number: s.roundIndex + 1, total: TOTAL_ROUNDS },
    startup: STARTUPS[s.roundIndex],
    wallet: {
      balance: s.balance,
      investedInRound: s.invested,
      roundCap: getRoundCap(s.roundStartBalance),
      alreadyInvested: (isMarketOpen || s.phase === "voting") && s.invested > 0,
    },
    market: isMarketOpen
      ? {
          price: getMarketPrice(s.raised),
          priceChange: getMarketPrice(s.raised) - EVENT_CONFIG.priceBase,
          totalRaised: s.raised,
          investorCount: s.investors,
        }
      : null,
    clock: isMarketOpen
      ? {
          serverTime: new Date().toISOString(),
          phaseEndsAt: new Date(
            s.phase === "lastCall" ? Date.now() + s.countdown * 1000 : s.openEndsAt,
          ).toISOString(),
          paused: false,
          pausedSeconds: null,
        }
      : null,
    verdict: isRevealed && lastSettled ? computeVerdict(s.settled.length - 1, lastSettled) : null,
    standing: s.settled.length > 0 ? buildStanding(s) : null,
    rounds: buildRounds(s),
    winnerStartup: s.phase === "final" ? DEMO_WINNER : null,
  };
}

function startRound(s: MockState): MockState {
  return {
    ...s,
    phase: "open",
    roundStartBalance: s.balance,
    invested: 0,
    raised: 0,
    investors: 0,
    countdown: EVENT_CONFIG.lastCallSeconds,
    openEndsAt: Date.now() + (PHASE_DURATION_MS.open ?? 0),
  };
}

function revealVerdict(s: MockState): MockState {
  const annulment = ROUND_ANNULMENTS[s.roundIndex] ?? null;
  const multiplier = annulment !== null ? 1 : multiplierForScore(ROUND_SCORES[s.roundIndex]);
  const payout = Math.round(s.invested * multiplier);
  const hit = annulment === null && s.invested > 0 && isHitMultiplier(multiplier);
  return {
    ...s,
    phase: "result",
    balance: s.balance + payout,
    previousPosition: s.position,
    position: positionFor(s.balance + payout),
    hits: s.hits + (hit ? 1 : 0),
    settled: [
      ...s.settled,
      { invested: s.invested, payout, multiplier, annulment, settledAt: new Date().toISOString() },
    ],
  };
}

/** Avanza una fase por temporizador. */
function advancePhase(s: MockState): MockState {
  switch (s.phase) {
    case "scheduled":
      return startRound(s);
    case "open":
      return { ...s, phase: "lastCall", countdown: EVENT_CONFIG.lastCallSeconds };
    case "lastCall":
      return { ...s, phase: "voting", countdown: 0 };
    case "voting":
      return revealVerdict(s);
    case "result":
      if (s.roundIndex + 1 >= TOTAL_ROUNDS) return { ...s, phase: "final" };
      return { ...s, phase: "scheduled", roundIndex: s.roundIndex + 1, invested: 0 };
    default:
      return s;
  }
}

/** Descuenta un segundo de la última llamada y cierra el mercado al llegar a cero. */
function tickCountdown(s: MockState): MockState {
  if (s.phase !== "lastCall") return s;
  const next = s.countdown - 1;
  if (next <= 0) return { ...s, phase: "voting", countdown: 0 };
  return { ...s, countdown: next };
}

/** Simula inversión de la sala durante el mercado abierto. */
function simulateRoomInvestment(s: MockState): MockState {
  if (s.phase !== "open" && s.phase !== "lastCall") return s;
  const amount = Math.floor(ROOM_MIN_COINS + Math.random() * ROOM_RANGE_COINS);
  const extra = Math.random() > 0.6 ? 2 : 1;
  return {
    ...s,
    raised: s.raised + amount,
    investors: Math.min(MAX_INVESTORS, s.investors + extra),
  };
}

/** Hook de simulación con la misma forma que useParticipantState de la API real. */
export function useParticipantMockState(): UseParticipantStateResult {
  const [state, setState] = useState<MockState>(INITIAL_STATE);
  /** Última versión confirmada del estado, para validar inversiones sin esperar al render. */
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Se aplica después del primer render para que el servidor y el cliente coincidan en la hidratación.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get(SIGN_IN_PARAM) === SIGN_IN_PARAM_VALUE) {
      setState((s) => ({ ...s, phase: "login" }));
    }
  }, []);

  useEffect(() => {
    const delay = PHASE_DURATION_MS[state.phase];
    if (delay === undefined) return;
    const timer = window.setTimeout(() => setState(advancePhase), delay);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.roundIndex]);

  useEffect(() => {
    if (state.phase !== "open" && state.phase !== "lastCall") return;
    const timer = window.setInterval(
      () => setState(simulateRoomInvestment),
      ROOM_TICK_MS,
    );
    return () => window.clearInterval(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "lastCall") return;
    const timer = window.setInterval(() => setState(tickCountdown), 1_000);
    return () => window.clearInterval(timer);
  }, [state.phase]);

  const invest = useCallback(async (amount: number): Promise<InvestmentResult> => {
    const current = stateRef.current;
    if (current.phase !== "open" && current.phase !== "lastCall") {
      return { ok: false, message: MARKET_CLOSED_MESSAGE };
    }
    if (current.invested > 0) {
      return { ok: false, message: "Ya invertiste en esta ronda." };
    }
    const remainingCap = getRoundCap(current.roundStartBalance);
    const issue = getInvestmentIssue({ amount, balance: current.balance, remainingCap });
    if (issue !== null) {
      return { ok: false, message: describeInvestmentIssue(issue, formatCoins(remainingCap)) };
    }
    setState((s) => {
      if (s.phase !== "open" && s.phase !== "lastCall") return s;
      return {
        ...s,
        balance: s.balance - amount,
        invested: s.invested + amount,
        raised: s.raised + amount,
        investors: s.invested > 0 ? s.investors : s.investors + 1,
      };
    });
    return { ok: true };
  }, []);

  const vm = useMemo(() => deriveViewModel(state), [state]);
  const actions = useMemo<ParticipantActions>(() => ({ invest }), [invest]);

  return { vm, status: "ready", errorMessage: null, actions };
}
