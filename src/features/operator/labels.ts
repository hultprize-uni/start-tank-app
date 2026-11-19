import type { RoundStatus } from "./types";

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

/** Etiquetas de las acciones registradas en el registro del operador. */
export const OPERATOR_ACTION_LABELS: Readonly<Record<string, string>> = {
  OPEN: "Abrir mercado",
  LAST_CALL: "Declarar última llamada",
  CLOSE: "Cerrar mercado",
  ENABLE_VOTING: "Habilitar votación",
  REVEAL: "Revelar veredicto",
  CANCEL_REFUND: "Anular y devolver",
  CANCEL_SETTLE_1X: "Anular y liquidar a 1.0x",
  MANUAL_SETTLE: "Liquidación manual",
  AUTO_CLOSE: "Cierre automático de la última llamada",
  UNDO: "Deshacer última acción",
};

/** Texto que indica que la función depende de la API y aún no existe. */
export const PENDING_API_NOTE = "Pendiente de API";

/** Formatea montos en Impact Coins con separador de miles en español. */
export function formatCoins(value: number): string {
  return value.toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

/**
 * Formatea un multiplicador con hasta dos decimales y sin ceros finales: 1.4 se muestra como
 * 1.4x, 1.27 como 1.27x y 1 como 1x.
 */
export function formatMultiplier(value: number): string {
  return `${Number(value.toFixed(2))}x`;
}

/** Formatea un puntaje entre 0 y 1 con dos decimales. */
export function formatScore(value: number): string {
  return value.toFixed(2);
}

/** Formatea segundos como m:ss, por ejemplo 0:45. Los valores negativos se tratan como cero. */
export function formatSeconds(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
