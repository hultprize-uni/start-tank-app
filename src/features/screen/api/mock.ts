import { EVENT_CONFIG } from "@/shared/domain/config";
import type {
  ScreenInvestorRow,
  ScreenStartupRow,
  RoundRef,
  ScreenPhase,
  ScreenViewModel,
  WinningStartup,
  RevealedVote,
} from "../types";

/*
 * Fuente simulada de la pantalla del evento. Se usa solo con NEXT_PUBLIC_USE_MOCKS=true o con el
 * parámetro de fase en desarrollo; el hook `useScreenState` (hooks/useScreenState.ts) la consume en esos
 * casos. Produce la misma interfaz `ScreenViewModel` que devuelve `GET /api/screen`.
 */

/** Fase que se muestra cuando no se fuerza una por query. */
export const MOCK_PHASE: ScreenPhase = "MARKET";

const MOCK_ROUND: RoundRef = {
  number: 4,
  startup: {
    name: "Aqua Viva",
    sdg: { number: 6, name: "Agua limpia y saneamiento" },
  },
};

const MOCK_INVESTORS: ScreenInvestorRow[] = [
  { position: 1, name: "Lucia Mendoza", balance: 14_800 },
  { position: 2, name: "Andres Rojas", balance: 13_250 },
  { position: 3, name: "Valeria Chavez", balance: 12_900 },
  { position: 4, name: "Diego Paredes", balance: 11_400 },
  { position: 5, name: "Sofia Quispe", balance: 10_950 },
  { position: 6, name: "Mateo Huaman", balance: 10_400 },
  { position: 7, name: "Camila Ortiz", balance: 9_850 },
  { position: 8, name: "Renzo Villar", balance: 9_300 },
  { position: 9, name: "Daniela Pino", balance: 8_700 },
  { position: 10, name: "Jorge Salas", balance: 8_150 },
  { position: 11, name: "Fernanda Lazo", balance: 7_600 },
  { position: 12, name: "Bruno Cárdenas", balance: 7_050 },
];

const MOCK_STARTUPS: ScreenStartupRow[] = [
  { position: 1, name: "Aqua Viva", accumulated: 9_500, price: 148 },
  { position: 2, name: "Huella Verde", accumulated: 8_200, price: 141 },
  { position: 3, name: "Kallpa Energia", accumulated: 6_750, price: 134 },
  { position: 4, name: "Tejido Andino", accumulated: 4_300, price: 121 },
  { position: 5, name: "Nodo Salud", accumulated: 2_900, price: 115 },
];

const MOCK_VOTES: RevealedVote[] = [
  { juror: "Jurado 1", decision: "BACK" },
  { juror: "Jurado 2", decision: "BACK" },
  { juror: "Jurado 3", decision: "REJECT" },
  { juror: "Jurado 4", decision: "ABSTAIN" },
];

/** Precio en vivo: sube por cada `priceStepCoins` de monto acumulado, dentro de los limites. */
function computePrice(accumulated: number): number {
  const { priceBase, priceMin, priceMax, priceStepCoins } = EVENT_CONFIG;
  const price = Math.round(priceBase + accumulated / priceStepCoins);
  return Math.min(priceMax, Math.max(priceMin, price));
}

/** Fraccion de respaldo: respaldos entre votos emitidos. Las abstenciones se excluyen. */
function computeFraction(votes: RevealedVote[]): number {
  const cast = votes.filter((vote) => vote.decision !== "ABSTAIN");
  if (cast.length === 0) return 0;
  const backs = cast.filter((vote) => vote.decision === "BACK").length;
  return backs / cast.length;
}

function computeMultiplier(fraction: number): number {
  return EVENT_CONFIG.multiplierBase + EVENT_CONFIG.multiplierSlope * fraction;
}

function buildSettlement(now: string): ScreenViewModel {
  const amountInvested = 7_500;
  const backingFraction = computeFraction(MOCK_VOTES);
  const multiplier = computeMultiplier(backingFraction);
  return {
    phase: "SETTLEMENT",
    updatedAt: now,
    round: MOCK_ROUND,
    votes: MOCK_VOTES,
    backingFraction,
    multiplier,
    amountInvested,
    roundReturn: Math.round(amountInvested * multiplier),
  };
}

function buildClosing(now: string): ScreenViewModel {
  const backingFraction = 0.75;
  const investorPercentage = 0.6;
  const winner: WinningStartup = {
    name: MOCK_STARTUPS[0].name,
    sdg: { number: 6, name: "Agua limpia y saneamiento" },
    score:
      EVENT_CONFIG.winnerWeightJury * backingFraction +
      EVENT_CONFIG.winnerWeightTraction * investorPercentage,
    backingFraction,
    investorPercentage,
  };
  return {
    phase: "CLOSING",
    updatedAt: now,
    winner,
    top3: MOCK_INVESTORS.slice(0, 3),
    bestEye: { name: "Valeria Chavez", hits: 5 },
  };
}

/** Produce el modelo de una fase. `tick` avanza con cada sondeo para simular actividad en vivo. */
export function simulateReading(phase: ScreenPhase, tick: number): ScreenViewModel {
  const now = new Date().toISOString();

  switch (phase) {
    case "MARKET": {
      const accumulated = 4_000 + tick * 500;
      return {
        phase,
        updatedAt: now,
        round: MOCK_ROUND,
        price: computePrice(accumulated),
        accumulated,
        uniqueInvestors: 18 + tick,
      };
    }
    case "LAST_CALL": {
      const accumulated = 9_500 + tick * 250;
      return {
        phase,
        updatedAt: now,
        round: MOCK_ROUND,
        price: computePrice(accumulated),
        accumulated,
        uniqueInvestors: 31,
        secondsRemaining: Math.max(0, EVENT_CONFIG.lastCallSeconds - tick * 2),
      };
    }
    case "VOTING":
      return {
        phase,
        updatedAt: now,
        round: MOCK_ROUND,
        votesCast: Math.min(MOCK_VOTES.length, 1 + Math.floor(tick / 2)),
        jurorsTotal: MOCK_VOTES.length,
      };
    case "SETTLEMENT":
      return buildSettlement(now);
    case "BETWEEN_ROUNDS":
      return {
        phase,
        updatedAt: now,
        closedRound: MOCK_ROUND,
        investors: MOCK_INVESTORS,
        startups: MOCK_STARTUPS,
      };
    case "CLOSING":
      return buildClosing(now);
  }
}

