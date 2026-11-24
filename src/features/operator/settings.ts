import type { CriterionConfigView, SettingUnit, SettingView } from "./types";

/*
 * Parámetros editables desde Configuración (RF-28, RNF-14) y sus reglas de validación. Las claves
 * son las de la tabla configuracion; la consola y el servidor validan con las mismas reglas.
 */

export interface SettingDefinition {
  key: string;
  label: string;
  group: SettingView["group"];
  unit: SettingUnit;
  min: number;
  max: number;
  integer: boolean;
}

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  { key: "capital_inicial", label: "Capital inicial", group: "money", unit: "coins", min: 1, max: 1_000_000, integer: true },
  { key: "compra_minima", label: "Compra mínima", group: "money", unit: "coins", min: 1, max: 1_000_000, integer: true },
  { key: "tope_ronda", label: "Tope por ronda", group: "money", unit: "ratio", min: 0.01, max: 1, integer: false },
  { key: "precio_min", label: "Precio mínimo", group: "money", unit: "price", min: 1, max: 10_000, integer: false },
  { key: "precio_max", label: "Precio máximo", group: "money", unit: "price", min: 1, max: 10_000, integer: false },
  { key: "duracion_pitch_s", label: "Pitch", group: "durations", unit: "seconds", min: 10, max: 3_600, integer: true },
  { key: "duracion_toma_y_dame_s", label: "Toma y dame", group: "durations", unit: "seconds", min: 10, max: 3_600, integer: true },
  { key: "duracion_ultima_llamada_s", label: "Última llamada", group: "durations", unit: "seconds", min: 10, max: 3_600, integer: true },
  { key: "duracion_votacion_s", label: "Votación", group: "durations", unit: "seconds", min: 10, max: 3_600, integer: true },
  { key: "duracion_resultado_s", label: "Resultado", group: "durations", unit: "seconds", min: 10, max: 3_600, integer: true },
  { key: "retraso_telefono_s", label: "Retraso de los teléfonos", group: "durations", unit: "seconds", min: 0, max: 10, integer: false },
];

const BY_KEY = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]));

export function settingDefinition(key: string): SettingDefinition | undefined {
  return BY_KEY.get(key);
}

/**
 * Valida un valor nuevo frente a su definición y a los demás parámetros vigentes. Devuelve el
 * código de error o null si es válido.
 */
export function validateSetting(
  key: string,
  value: number,
  current: Readonly<Record<string, number>>,
): string | null {
  const definition = BY_KEY.get(key);
  if (definition === undefined) return "INVALID_CONFIG_KEY";
  if (!Number.isFinite(value) || value < definition.min || value > definition.max) {
    return "INVALID_CONFIG_VALUE";
  }
  if (definition.integer && !Number.isInteger(value)) return "INVALID_CONFIG_VALUE";
  if (key === "precio_min" && current.precio_max !== undefined && value >= current.precio_max) {
    return "PRICE_RANGE_INVALID";
  }
  if (key === "precio_max" && current.precio_min !== undefined && value <= current.precio_min) {
    return "PRICE_RANGE_INVALID";
  }
  if (
    key === "compra_minima" &&
    current.capital_inicial !== undefined &&
    value > current.capital_inicial
  ) {
    return "MIN_ABOVE_CAPITAL";
  }
  return null;
}

/** Convierte las filas clave y valor en la lista de parámetros editables, en orden. */
export function buildSettings(values: Readonly<Record<string, number>>): SettingView[] {
  return SETTING_DEFINITIONS.filter((definition) => values[definition.key] !== undefined).map(
    (definition) => ({
      key: definition.key,
      label: definition.label,
      group: definition.group,
      unit: definition.unit,
      value: values[definition.key],
    }),
  );
}

/** Tolerancia para comparar la suma de los pesos con 1. */
const WEIGHT_EPSILON = 0.001;

/** Valida la lista completa de criterios: textos no vacíos y pesos que suman 1. */
export function validateCriteria(items: readonly CriterionConfigView[]): string | null {
  if (items.length === 0) return "INVALID_CRITERIA";
  for (const item of items) {
    if (
      item.name.trim() === "" ||
      item.anchorMin.trim() === "" ||
      item.anchorMax.trim() === "" ||
      !Number.isFinite(item.weight) ||
      item.weight <= 0 ||
      item.weight > 1
    ) {
      return "INVALID_CRITERIA";
    }
  }
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return Math.abs(total - 1) <= WEIGHT_EPSILON ? null : "WEIGHTS_NOT_ONE";
}
