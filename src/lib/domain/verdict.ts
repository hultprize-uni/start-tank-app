import { EVENT_CONFIG } from "./config";
import type { Decision, VerdictResult } from "./types";

/** Fracción de respaldo asumida cuando no existen votos computables. */
const NEUTRAL_FRACTION = 0.5;

/**
 * Calcula el multiplicador de una fracción de respaldo mediante la fórmula
 * base + pendiente x fracción, con los parámetros de EVENT_CONFIG.
 */
export function multiplierFor(fraction: number): number {
  return EVENT_CONFIG.multiplierBase + EVENT_CONFIG.multiplierSlope * fraction;
}

/**
 * Calcula el veredicto de una ronda a partir de las decisiones de los jurados.
 * Las abstenciones se excluyen del denominador. Cuando no existen votos
 * computables, la fracción de respaldo es 0.5 y el multiplicador resultante es 1.0x.
 */
export function calcVerdict(decisions: readonly Decision[]): VerdictResult {
  let backs = 0;
  let voters = 0;

  for (const decision of decisions) {
    if (decision === "SE_ABSTIENE") {
      continue;
    }
    voters += 1;
    if (decision === "RESPALDA") {
      backs += 1;
    }
  }

  const fraction = voters === 0 ? NEUTRAL_FRACTION : backs / voters;

  return { backs, voters, fraction, multiplier: multiplierFor(fraction) };
}
