import { EVENT_CONFIG } from "./config";

/** Tolerancia para comparar puntajes con aritmética de punto flotante. */
const SCORE_EPSILON = 1e-9;

/** Situación de una startup al cerrar el evento. */
export interface StartupStanding {
  id: string;
  /** Fracción del jurado, entre 0 y 1: (puntaje - 1) / 4. Ver juryFraction. */
  fraction: number;
  /** Porcentaje de asistentes que invirtieron en la startup, entre 0 y 1. */
  investorPct: number;
}

/** Registro de un asistente con el multiplicador de cada ronda en que invirtió. */
export interface ParticipantRecord {
  id: string;
  investmentMultipliers: readonly number[];
}

/** Asistente con mejor ojo: el que más veces invirtió en startups con multiplicador mayor que 1. */
export interface BestEye {
  id: string;
  hits: number;
}

/** Puntaje final de una startup: 60 % jurado y 40 % de asistentes que invirtieron en ella (RF-30). */
export function startupScore(fraction: number, investorPct: number): number {
  return (
    EVENT_CONFIG.winnerWeightJury * fraction + EVENT_CONFIG.winnerWeightTraction * investorPct
  );
}

/**
 * Startup ganadora por puntaje final. Ante empate gana la de mejor fracción del jurado; si también
 * coincide, la primera en el orden de entrada. Devuelve undefined con la lista vacía.
 */
export function pickWinner<T extends StartupStanding>(startups: readonly T[]): T | undefined {
  let winner: T | undefined;
  let winnerScore = 0;

  for (const startup of startups) {
    const score = startupScore(startup.fraction, startup.investorPct);
    if (winner === undefined) {
      winner = startup;
      winnerScore = score;
      continue;
    }
    const better = score > winnerScore + SCORE_EPSILON;
    const breaksTie =
      Math.abs(score - winnerScore) <= SCORE_EPSILON && startup.fraction > winner.fraction;
    if (better || breaksTie) {
      winner = startup;
      winnerScore = score;
    }
  }

  return winner;
}

/** Una inversión es acierto cuando su ronda se liquidó con multiplicador mayor que 1.0. */
export function isHit(multiplier: number): boolean {
  return multiplier > 1 + SCORE_EPSILON;
}

export function countHits(investmentMultipliers: readonly number[]): number {
  return investmentMultipliers.filter(isHit).length;
}

/** Asistente con más aciertos; ante empate, el primero en el orden de entrada. */
export function bestEye(investors: readonly ParticipantRecord[]): BestEye | undefined {
  let best: BestEye | undefined;
  for (const investor of investors) {
    const hits = countHits(investor.investmentMultipliers);
    if (best === undefined || hits > best.hits) {
      best = { id: investor.id, hits };
    }
  }
  return best;
}
