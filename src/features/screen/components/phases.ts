import type { ScreenPhase } from "../types";

/** Orden de las fases en la jornada y etiqueta de cada una en el encabezado. */
export const SCREEN_PHASES: { value: ScreenPhase; label: string }[] = [
  { value: "MARKET", label: "Mercado abierto" },
  { value: "LAST_CALL", label: "Última llamada" },
  { value: "VOTING", label: "Votación" },
  { value: "SETTLEMENT", label: "Liquidación" },
  { value: "BETWEEN_ROUNDS", label: "Entre rondas" },
  { value: "CLOSING", label: "Cierre del evento" },
];

/** Interpreta el valor del parametro `fase` de la URL. Devuelve undefined si no corresponde a una fase. */
export function parsePhase(value: string | undefined): ScreenPhase | undefined {
  return SCREEN_PHASES.find((phase) => phase.value === value)?.value;
}

/** Etiqueta de una fase para el encabezado y el selector. */
export function phaseLabel(value: ScreenPhase): string {
  return SCREEN_PHASES.find((phase) => phase.value === value)?.label ?? value;
}
