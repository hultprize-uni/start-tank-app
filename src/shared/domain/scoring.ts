import { EVENT_CONFIG } from "./config";

/** Número mínimo de respaldos para que una inversión cuente como acierto. */
const HIT_MIN_BACKS = 3;

/** Tolerancia para comparar puntajes con aritmética de punto flotante. */
const SCORE_EPSILON = 1e-9;

/** Situación de una startup al liquidar la última ronda. */
export interface StartupStanding {
  id: string;
  /** Fracción de respaldo del jurado, entre 0 y 1. */
  fraction: number;
  /** Porcentaje de asistentes que invirtieron en la startup, expresado entre 0 y 1. */
  investorPct: number;
}

/** Registro de un asistente con los respaldos obtenidos por cada una de sus inversiones. */
export interface InvestorRecord {
  id: string;
  investmentBacks: readonly number[];
}

/** Asistente con mejor criterio de inversión. */
export interface BestEye {
  id: string;
  hits: number;
}

/**
 * Calcula el puntaje de una startup: peso del jurado por la fracción de respaldo
 * más peso de la tracción por el porcentaje de asistentes que invirtieron.
 */
export function startupScore(fraction: number, investorPct: number): number {
  return (
    EVENT_CONFIG.winnerWeightJury * fraction + EVENT_CONFIG.winnerWeightTraction * investorPct
  );
}

/**
 * Determina la startup ganadora por puntaje más alto. Ante empate se elige la de
 * mayor fracción de respaldo. Si ambos criterios coinciden, prevalece la primera
 * startup en el orden de entrada. Devuelve undefined cuando la lista está vacía.
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

    const tie = Math.abs(score - winnerScore) <= SCORE_EPSILON;
    const better = score > winnerScore + SCORE_EPSILON;
    const breaksTie = tie && startup.fraction > winner.fraction;

    if (better || breaksTie) {
      winner = startup;
      winnerScore = score;
    }
  }

  return winner;
}

/**
 * Cuenta los aciertos a partir de los respaldos de cada inversión. Una inversión
 * es acierto cuando su startup obtuvo al menos 3 respaldos.
 */
export function countHits(investmentBacks: readonly number[]): number {
  return investmentBacks.filter((backs) => backs >= HIT_MIN_BACKS).length;
}

/**
 * Identifica al asistente con mejor ojo, es decir, con mayor número de aciertos.
 * Ante empate se devuelve el primero en el orden de entrada. Devuelve undefined
 * cuando la lista está vacía.
 */
export function bestEye(investors: readonly InvestorRecord[]): BestEye | undefined {
  let best: BestEye | undefined;

  for (const investor of investors) {
    const hits = countHits(investor.investmentBacks);
    if (best === undefined || hits > best.hits) {
      best = { id: investor.id, hits };
    }
  }

  return best;
}
