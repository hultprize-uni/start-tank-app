import { EVENT_CONFIG } from "./config";

/**
 * Calcula el precio en vivo de una startup a partir del monto acumulado por la sala.
 * El precio sube una unidad por cada priceStepCoins invertidos, se limita al
 * intervalo [priceMin, priceMax] y no depende del número de operaciones.
 * Los montos negativos se tratan como cero.
 */
export function livePrice(totalCoins: number): number {
  if (!Number.isFinite(totalCoins)) {
    throw new RangeError("El monto acumulado debe ser un número finito");
  }

  const coins = Math.max(0, totalCoins);
  const raw = EVENT_CONFIG.priceBase + coins / EVENT_CONFIG.priceStepCoins;

  return Math.min(EVENT_CONFIG.priceMax, Math.max(EVENT_CONFIG.priceMin, raw));
}
