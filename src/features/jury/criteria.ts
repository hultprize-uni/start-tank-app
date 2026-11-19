import type { JuryCriterion } from "./types";

/**
 * Criterios de evaluación que el portal del jurado recuerda en cada ronda. Pesan igual. Vive fuera
 * de server/ para que el mock de la interfaz y el mapeador del servidor compartan los mismos textos.
 */
export const JURY_CRITERIA: readonly JuryCriterion[] = [
  { id: "viability", label: "Viabilidad del negocio" },
  { id: "sdg_impact", label: "Impacto alineado con los ODS" },
];
