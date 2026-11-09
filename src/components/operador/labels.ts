import type { RoundStatus } from "@/lib/api/operator.types";

/** Etiquetas visibles de cada estado de ronda. */
export const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
  PROGRAMADA: "Programada",
  ABIERTA: "Abierta",
  ULTIMA_LLAMADA: "Última llamada",
  CERRADA: "Cerrada",
  EN_VOTACION: "En votación",
  LIQUIDADA: "Liquidada",
  ANULADA: "Anulada",
};

/** Formatea montos en Impact Coins con separador de miles en español. */
export function formatCoins(value: number): string {
  return value.toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

/** Formatea un multiplicador con dos decimales, por ejemplo 1.40x. */
export function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}
