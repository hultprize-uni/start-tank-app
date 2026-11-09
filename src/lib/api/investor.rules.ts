import { EVENT_CONFIG } from "@/lib/domain/config";

/** Motivo por el que un monto de inversión no puede confirmarse. */
export type InvestmentIssue = "below-min" | "above-cap" | "above-balance";

/** Tope de inversión de una ronda: fracción configurada del saldo al abrir la ronda. */
export function getRoundCap(startingBalance: number): number {
  return Math.floor(startingBalance * EVENT_CONFIG.roundCapRatio);
}

/** Precio de la startup según el monto acumulado de la sala, acotado a los límites configurados. */
export function getMarketPrice(totalRaised: number): number {
  const raw = EVENT_CONFIG.priceBase + totalRaised / EVENT_CONFIG.priceStepCoins;
  const bounded = Math.min(EVENT_CONFIG.priceMax, Math.max(EVENT_CONFIG.priceMin, raw));
  return Math.round(bounded);
}

/**
 * Multiplicador del veredicto: 0.2 + 1.6 x fracción de respaldo.
 * Las abstenciones no entran en el denominador; sin votos emitidos la fracción es 0.
 */
export function getMultiplier(backs: number, voters: number): number {
  const fraction = voters > 0 ? backs / voters : 0;
  return EVENT_CONFIG.multiplierBase + EVENT_CONFIG.multiplierSlope * fraction;
}

/** Valida un monto de inversión contra el mínimo, el tope restante y el saldo. Devuelve null si es válido. */
export function getInvestmentIssue(input: {
  amount: number;
  balance: number;
  remainingCap: number;
}): InvestmentIssue | null {
  const { amount, balance, remainingCap } = input;
  if (amount < EVENT_CONFIG.minInvestment) return "below-min";
  if (amount > remainingCap) return "above-cap";
  if (amount > balance) return "above-balance";
  return null;
}
