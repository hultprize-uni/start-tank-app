import { useCallback, useEffect, useMemo, useState } from "react";
import { EVENT_CONFIG } from "@/lib/domain/config";
import type { Decision } from "@/lib/domain/types";
import {
  getInvestmentIssue,
  getMarketPrice,
  getMultiplier,
  getRoundCap,
} from "@/lib/api/investor.rules";
import type {
  InvestorPhase,
  InvestorViewModel,
  StandingEntry,
  StandingInfo,
  StartupInfo,
  VerdictInfo,
} from "@/lib/api/investor.types";

/**
 * Simulación del estado del inversionista. Devuelve la forma que tendrá la API real
 * (InvestorViewModel) con datos de ejemplo y transiciones de tiempo fijo.
 */

const TOTAL_ROUNDS = 5;
const PARTICIPANTS = 74;
/** Posición de referencia: el saldo inicial equivale al puesto 40. */
const REFERENCE_POSITION = 40;
const COINS_PER_POSITION = 150;

/** Duración simulada de cada fase, en milisegundos. La última llamada usa el conteo configurado. */
const PHASE_DURATION_MS: Partial<Record<InvestorPhase, number>> = {
  scheduled: 8_000,
  open: 25_000,
  voting: 8_000,
  result: 12_000,
};
const ROOM_TICK_MS = 3_000;
const ROOM_MIN_COINS = 250;
const ROOM_RANGE_COINS = 1_800;
const MAX_INVESTORS = 70;

const STARTUPS: StartupInfo[] = [
  { name: "Aurora Agro", ods: "ODS 2 · Hambre cero", description: "Startup de ejemplo para la demostración." },
  { name: "Nodo Solar", ods: "ODS 7 · Energía asequible", description: "Startup de ejemplo para la demostración." },
  { name: "Aqua Lima", ods: "ODS 6 · Agua limpia", description: "Startup de ejemplo para la demostración." },
  { name: "Tejido Vivo", ods: "ODS 12 · Producción responsable", description: "Startup de ejemplo para la demostración." },
  { name: "Ruta Verde", ods: "ODS 11 · Ciudades sostenibles", description: "Startup de ejemplo para la demostración." },
];

/** Votos simulados de los cuatro jurados por ronda. */
const ROUND_DECISIONS: Decision[][] = [
  ["RESPALDA", "RESPALDA", "RESPALDA", "RECHAZA"],
  ["RESPALDA", "RESPALDA", "RECHAZA", "SE_ABSTIENE"],
  ["RESPALDA", "RESPALDA", "RESPALDA", "RESPALDA"],
  ["RESPALDA", "RECHAZA", "RECHAZA", "RECHAZA"],
  ["RESPALDA", "RESPALDA", "RESPALDA", "RECHAZA"],
];

const TOP_NAMES = ["Sofía Mendoza", "Carlos Ruiz", "Lucía Paredes"];

interface MockState {
  phase: InvestorPhase;
  /** Índice de la ronda en curso, desde 0. */
  roundIndex: number;
  balance: number;
  /** Saldo al abrir la ronda; define el tope de inversión. */
  roundStartBalance: number;
  invested: number;
  raised: number;
  investors: number;
  countdown: number;
  position: number;
  previousPosition: number;
  hits: number;
}

export interface InvestorActions {
  /** Inicia sesión con OAuth. En la simulación solo avanza a la fase programada. */
  login: () => void;
  /** Confirma una inversión en la ronda abierta. Valida el monto contra las reglas del evento. */
  invest: (amount: number) => void;
}

export interface UseInvestorStateResult {
  vm: InvestorViewModel;
  actions: InvestorActions;
}

const INITIAL_STATE: MockState = {
  phase: "login",
  roundIndex: 0,
  balance: EVENT_CONFIG.initialBalance,
  roundStartBalance: EVENT_CONFIG.initialBalance,
  invested: 0,
  raised: 0,
  investors: 0,
  countdown: EVENT_CONFIG.lastCallSeconds,
  position: REFERENCE_POSITION,
  previousPosition: REFERENCE_POSITION,
  hits: 0,
};

function positionFor(balance: number): number {
  const raw = REFERENCE_POSITION - (balance - EVENT_CONFIG.initialBalance) / COINS_PER_POSITION;
  return Math.min(PARTICIPANTS, Math.max(1, Math.round(raw)));
}

function balanceForPosition(position: number): number {
  return EVENT_CONFIG.initialBalance + (REFERENCE_POSITION - position) * COINS_PER_POSITION;
}

function computeVerdict(roundIndex: number, invested: number): VerdictInfo {
  const decisions = ROUND_DECISIONS[roundIndex];
  const backs = decisions.filter((d) => d === "RESPALDA").length;
  const voters = decisions.filter((d) => d !== "SE_ABSTIENE").length;
  const multiplier = getMultiplier(backs, voters);
  const payout = Math.round(invested * multiplier);
  return { decisions, backs, voters, multiplier, invested, payout, gain: payout - invested };
}

function buildStanding(s: MockState): StandingInfo {
  const me: StandingEntry = {
    position: s.position,
    name: "Tú",
    balance: s.balance,
    isCurrent: true,
  };
  const topThree: StandingEntry[] = TOP_NAMES.map((name, index) => ({
    position: index + 1,
    name,
    balance: balanceForPosition(index + 1),
    isCurrent: false,
  }));
  return {
    position: s.position,
    previousPosition: s.previousPosition,
    participants: PARTICIPANTS,
    hits: s.hits,
    hitsTotal: s.roundIndex + 1,
    topThree,
    me,
  };
}

function deriveViewModel(s: MockState): InvestorViewModel {
  if (s.phase === "login") {
    return {
      phase: s.phase,
      round: null,
      startup: null,
      wallet: null,
      market: null,
      countdownSeconds: null,
      verdict: null,
      standing: null,
    };
  }

  const isMarketOpen = s.phase === "open" || s.phase === "lastCall";
  const isRevealed = s.phase === "result" || s.phase === "final";

  return {
    phase: s.phase,
    round: { number: s.roundIndex + 1, total: TOTAL_ROUNDS },
    startup: STARTUPS[s.roundIndex],
    wallet: {
      balance: s.balance,
      investedInRound: s.invested,
      roundCap: getRoundCap(s.roundStartBalance),
    },
    market: isMarketOpen
      ? {
          price: getMarketPrice(s.raised),
          priceChange: getMarketPrice(s.raised) - EVENT_CONFIG.priceBase,
          totalRaised: s.raised,
          investorCount: s.investors,
        }
      : null,
    countdownSeconds: s.phase === "lastCall" ? s.countdown : null,
    verdict: isRevealed ? computeVerdict(s.roundIndex, s.invested) : null,
    standing: isRevealed ? buildStanding(s) : null,
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
  };
}

function revealVerdict(s: MockState): MockState {
  const verdict = computeVerdict(s.roundIndex, s.invested);
  const isHit = verdict.invested > 0 && verdict.backs >= 3;
  const position = positionFor(s.balance + verdict.payout);
  return {
    ...s,
    phase: "result",
    balance: s.balance + verdict.payout,
    previousPosition: s.position,
    position,
    hits: s.hits + (isHit ? 1 : 0),
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

export function useInvestorState(): UseInvestorStateResult {
  const [state, setState] = useState<MockState>(INITIAL_STATE);

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

  const login = useCallback(() => {
    setState((s) => (s.phase === "login" ? { ...s, phase: "scheduled" } : s));
  }, []);

  const invest = useCallback((amount: number) => {
    setState((s) => {
      if (s.phase !== "open" && s.phase !== "lastCall") return s;
      const remainingCap = getRoundCap(s.roundStartBalance) - s.invested;
      const issue = getInvestmentIssue({ amount, balance: s.balance, remainingCap });
      if (issue !== null) return s;
      return {
        ...s,
        balance: s.balance - amount,
        invested: s.invested + amount,
        raised: s.raised + amount,
        investors: s.invested > 0 ? s.investors : s.investors + 1,
      };
    });
  }, []);

  const vm = useMemo(() => deriveViewModel(state), [state]);
  const actions = useMemo<InvestorActions>(() => ({ login, invest }), [login, invest]);

  return { vm, actions };
}
