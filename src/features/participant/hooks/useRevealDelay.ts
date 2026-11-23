"use client";

import { EVENT_CONFIG } from "@/shared/domain/config";
import { useServerNow } from "@/shared/lib/use-server-clock";

/** Indica si ya pasó el retraso del teléfono desde la liquidación, con la hora del servidor. */
export function isRevealDue(settledAt: string | null, now: number, delayMs: number): boolean {
  if (settledAt === null) return true;
  const settled = Date.parse(settledAt);
  return !Number.isFinite(settled) || now >= settled + delayMs;
}

/**
 * El teléfono revela el veredicto 3 segundos después de la liquidación (RF-22, RNF-04), para que la
 * sala lo vea primero en el escenario. La espera se mide con la hora del servidor.
 */
export function useRevealDelay(
  settledAt: string | null,
  delayMs: number = EVENT_CONFIG.phoneRevealDelayMs,
): boolean {
  return isRevealDue(settledAt, useServerNow(200), delayMs);
}
