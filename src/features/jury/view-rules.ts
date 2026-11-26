import type { JuryPhase, JuryScreen } from "./types";

/** Fases en las que el jurado puede calificar en borrador los cuatro criterios (RF-14). */
export function isGradablePhase(phase: JuryPhase): boolean {
  return phase === "pitch" || phase === "open" || phase === "last_call" || phase === "closed" || phase === "voting";
}

/**
 * Pantalla visible para cada fase de la ronda y el envío propio. Vive fuera de server/ para que
 * el mock de la interfaz y el mapeador del servidor apliquen la misma regla.
 */
export function screenOf(phase: JuryPhase, hasSubmitted: boolean): JuryScreen {
  if (phase === "result") return "result";
  if (isGradablePhase(phase)) return hasSubmitted ? "vote_registered" : "grading";
  return "waiting";
}
