import { EVENT_CONFIG } from "./config";
import type { CriterionNote, Decision, VerdictResult } from "./types";

/** Redondea a la cantidad de decimales indicada, sin ruido de punto flotante. */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Fracción equivalente de un puntaje de 1 a 5: 0 con puntaje 1 y 1 con puntaje 5. Es la parte del
 * multiplicador que depende del jurado y la que pesa en el puntaje final de la startup.
 */
export function juryFraction(score: number): number {
  const span = EVENT_CONFIG.scoreMax - EVENT_CONFIG.scoreMin;
  return (score - EVENT_CONFIG.scoreMin) / span;
}

/** Multiplicador continuo: 0.2x con puntaje 1, 1.0x con 3 y 1.8x con 5. Tres decimales, como en SQL. */
export function multiplierForScore(score: number): number {
  return roundTo(
    EVENT_CONFIG.multiplierBase + EVENT_CONFIG.multiplierSlope * juryFraction(score),
    3,
  );
}

/** Puntaje de un jurado: promedio de sus notas ponderado por el peso de cada criterio. */
export function juryScore(notes: readonly CriterionNote[]): number {
  const weight = notes.reduce((sum, note) => sum + note.weight, 0);
  if (weight === 0) {
    throw new RangeError("El veredicto necesita al menos un criterio con peso");
  }
  return roundTo(notes.reduce((sum, note) => sum + note.value * note.weight, 0) / weight, 3);
}

/**
 * Veredicto de la ronda: promedio de los puntajes de los jurados que no se abstuvieron (null).
 * Devuelve null cuando nadie emitió puntaje; la ronda no puede liquidarse así.
 */
export function calcScoreVerdict(
  scores: readonly (number | null)[],
): { score: number; voters: number; multiplier: number } | null {
  const cast = scores.filter((score): score is number => score !== null);
  if (cast.length === 0) {
    return null;
  }
  const score = roundTo(cast.reduce((sum, value) => sum + value, 0) / cast.length, 4);
  return { score, voters: cast.length, multiplier: multiplierForScore(score) };
}

/**
 * @deprecated Reglas anteriores (respaldar o rechazar). Solo la usan el jurado, el admin y el
 * escenario hasta migrar en F4 a F6; el cálculo vigente es calcScoreVerdict.
 */
export function multiplierFor(fraction: number): number {
  return EVENT_CONFIG.multiplierBase + EVENT_CONFIG.multiplierSlope * fraction;
}

/** @deprecated Ver multiplierFor. */
export function calcVerdict(decisions: readonly Decision[]): VerdictResult {
  let backs = 0;
  let voters = 0;
  for (const decision of decisions) {
    if (decision === "ABSTAIN") continue;
    voters += 1;
    if (decision === "BACK") backs += 1;
  }
  const fraction = voters === 0 ? 0.5 : backs / voters;
  return { backs, voters, fraction, multiplier: multiplierFor(fraction) };
}
