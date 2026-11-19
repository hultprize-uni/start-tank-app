import type { RoundStatus } from "../types";

/** Etiquetas visibles de cada estado de ronda. */
export const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
  SCHEDULED: "Programada",
  OPEN: "Abierta",
  LAST_CALL: "Última llamada",
  CLOSED: "Cerrada",
  VOTING: "En votación",
  SETTLED: "Liquidada",
  CANCELLED: "Anulada",
};

/** Formatea montos en Impact Coins con separador de miles en español. */
export function formatCoins(value: number): string {
  return value.toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

/** Formatea un multiplicador con dos decimales, por ejemplo 1.40x. */
export function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}
