import { EVENT_CONFIG, type EventConfig } from "@/shared/domain/config";
import { sql } from "./client";

/*
 * Lectura de la tabla configuracion (RF-28). Las claves que falten conservan el valor por defecto de
 * EVENT_CONFIG, igual que fn_config_num en SQL.
 */

/** Banderas del sistema guardadas en configuracion. */
export interface EventFlags {
  eventStarted: boolean;
  manualMode: boolean;
}

export interface ConfigRow {
  clave: string;
  valor: string;
}

/** Clave de la base de datos, campo de EventConfig y factor de conversión. */
const NUMERIC_KEYS: Readonly<Record<string, [keyof EventConfig, number]>> = {
  capital_inicial: ["initialBalance", 1],
  compra_minima: ["minInvestment", 1],
  tope_ronda: ["roundCapRatio", 1],
  precio_min: ["priceMin", 1],
  precio_max: ["priceMax", 1],
  duracion_pitch_s: ["pitchSeconds", 1],
  duracion_toma_y_dame_s: ["qaSeconds", 1],
  duracion_ultima_llamada_s: ["lastCallSeconds", 1],
  duracion_votacion_s: ["votingSeconds", 1],
  duracion_resultado_s: ["resultSeconds", 1],
  retraso_telefono_s: ["phoneRevealDelayMs", 1000],
};

/** Claves que el conductor puede editar desde la consola, con su campo en EventConfig. */
export const EDITABLE_CONFIG_KEYS = Object.keys(NUMERIC_KEYS);

/** Convierte las filas de configuracion en parámetros y banderas. Ignora valores no numéricos. */
export function parseConfigRows(rows: readonly ConfigRow[]): {
  config: EventConfig;
  flags: EventFlags;
} {
  const config: EventConfig = { ...EVENT_CONFIG };
  const flags: EventFlags = { eventStarted: false, manualMode: false };

  for (const { clave, valor } of rows) {
    if (clave === "evento_iniciado") flags.eventStarted = valor === "true";
    else if (clave === "modo_manual") flags.manualMode = valor === "true";
    else if (clave in NUMERIC_KEYS) {
      const [field, factor] = NUMERIC_KEYS[clave];
      const value = Number(valor);
      if (Number.isFinite(value)) config[field] = value * factor;
    }
  }
  return { config, flags };
}

export async function readEventConfig(): Promise<{ config: EventConfig; flags: EventFlags }> {
  return parseConfigRows(await sql<ConfigRow>`select clave, valor from configuracion`);
}

export async function readConfigRows(): Promise<ConfigRow[]> {
  return sql<ConfigRow>`select clave, valor from configuracion order by clave`;
}

/** Guarda una clave de configuracion, creándola si no existe. */
export async function writeConfigValue(clave: string, valor: string): Promise<void> {
  await sql`
    insert into configuracion (clave, valor) values (${clave}, ${valor})
    on conflict (clave) do update set valor = excluded.valor`;
}
