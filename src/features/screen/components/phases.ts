import type { BadgeTone } from "@/shared/ui";
import type { ScreenPhase, ScreenViewModel } from "../types";

/** Orden de las fases en la jornada y etiqueta de cada una en el selector de desarrollo. */
export const SCREEN_PHASES: { value: ScreenPhase; label: string }[] = [
  { value: "WAITING", label: "Espera previa" },
  { value: "MARKET", label: "Mercado abierto" },
  { value: "LAST_CALL", label: "Última llamada" },
  { value: "VOTING", label: "Votación" },
  { value: "SETTLEMENT", label: "Liquidación" },
  { value: "BETWEEN_ROUNDS", label: "Entre rondas" },
  { value: "CLOSING", label: "Cierre del evento" },
];

/** Estado mostrado en el encabezado: texto, tono de la etiqueta y punto en vivo. */
export interface PhaseStatus {
  label: string;
  tone: BadgeTone;
  live: boolean;
}

const PHASE_STATUS: Record<ScreenPhase, PhaseStatus> = {
  WAITING: { label: "Por comenzar", tone: "neutral", live: false },
  MARKET: { label: "Mercado abierto", tone: "cyan", live: true },
  LAST_CALL: { label: "Última llamada", tone: "yellow", live: true },
  VOTING: { label: "Votación en curso", tone: "pink", live: true },
  SETTLEMENT: { label: "Ronda liquidada", tone: "cyan", live: false },
  BETWEEN_ROUNDS: { label: "Entre rondas", tone: "neutral", live: false },
  CLOSING: { label: "Evento cerrado", tone: "pink", live: false },
};

/** Estado del encabezado para una fase del view model. */
export function phaseStatus(value: ScreenPhase): PhaseStatus {
  return PHASE_STATUS[value];
}

/** Interpreta el valor del parametro `fase` de la URL. Devuelve undefined si no corresponde a una fase. */
export function parsePhase(value: string | undefined): ScreenPhase | undefined {
  return SCREEN_PHASES.find((phase) => phase.value === value)?.value;
}

/** Número de la ronda que la fase presenta, o undefined cuando la fase no se refiere a una ronda. */
export function roundNumberOf(vm: ScreenViewModel): number | undefined {
  switch (vm.phase) {
    case "WAITING":
      return vm.nextRound.number;
    case "BETWEEN_ROUNDS":
      return vm.closedRound.number;
    case "CLOSING":
      return undefined;
    default:
      return vm.round.number;
  }
}
