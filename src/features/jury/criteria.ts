import type { Criterion } from "@/shared/domain/types";

/** Nota entera válida del 1 al 5 para calificar un criterio. */
export type ScoreValue = 1 | 2 | 3 | 4 | 5;

/** Valores de la escala de calificación, en orden ascendente. */
export const SCORE_VALUES: readonly ScoreValue[] = [1, 2, 3, 4, 5];

/** Etiqueta corta de referencia para cada nota de la escala del 1 al 5. */
export const SCORE_LABELS: Readonly<Record<ScoreValue, string>> = {
  1: "No invertiría",
  2: "Débil",
  3: "Neutro",
  4: "Sólido",
  5: "Invertiría hoy",
};

/**
 * Criterios por defecto del jurado (mismo contenido que db/migrations/20261124000700_datos_base.sql).
 * Se usan en la simulación y como respaldo si aún no llegan criterios del servidor.
 */
export const DEFAULT_JURY_CRITERIA: readonly Criterion[] = [
  {
    id: "1",
    name: "Problema y mercado",
    weight: 0.25,
    anchorMin: "Problema difuso, sin mercado claro",
    anchorMax: "Problema real y mercado grande bien definido",
  },
  {
    id: "2",
    name: "Modelo de negocio",
    weight: 0.25,
    anchorMin: "No explica cómo genera ingresos",
    anchorMax: "Ingresos claros, escalables y con costos controlados",
  },
  {
    id: "3",
    name: "Impacto ODS",
    weight: 0.25,
    anchorMin: "Impacto social o ambiental marginal",
    anchorMax: "Impacto medible y alineado a un ODS",
  },
  {
    id: "4",
    name: "Equipo y pitch",
    weight: 0.25,
    anchorMin: "Equipo sin experiencia, pitch confuso",
    anchorMax: "Equipo sólido y pitch convincente",
  },
];

/** Motivos de conflicto de interés mostrados en la hoja de abstención. No se almacenan. */
export const ABSTAIN_REASONS: readonly string[] = [
  "Vínculo familiar o personal con el equipo",
  "Relación laboral, académica o de asesoría",
  "Interés financiero o participación previa",
  "Otro conflicto de interés con la startup",
];

/** Formatea un puntaje del 1 al 5 con 1 o 2 decimales (por ejemplo "4.0", "4.5" o "4.25"). */
export function formatScore(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2).replace(/0$/, "");
}

/** Formatea un multiplicador con 1 o 2 decimales (por ejemplo "1.4x", "1.0x" o "1.13x"). */
export function formatMultiplier(value: number): string {
  return `${value.toFixed(2).replace(/0$/, "")}x`;
}
