import type { Decision } from "@/shared/domain/types";
import type { JuryPhase, JuryScreen } from "./types";

/**
 * Pantalla visible para cada fase de la ronda y el voto propio. Vive fuera de server/ para que el
 * mock de la interfaz y el mapeador del servidor apliquen la misma regla.
 */
export function screenOf(phase: JuryPhase, ownVote: Decision | null): JuryScreen {
  if (phase === "voting") return ownVote === null ? "voting" : "vote_registered";
  if (phase === "result") return "result";
  return "waiting";
}
