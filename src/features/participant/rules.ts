import { EVENT_CONFIG } from "@/shared/domain/config";
import { roundCap } from "@/shared/domain/investment";

/** Motivo por el que un monto de inversión no puede confirmarse. */
export type InvestmentIssue = "below-min" | "above-cap" | "above-balance";

/** Tope de inversión de una ronda: 30 % del saldo con que se entra a la ronda. */
export function getRoundCap(startingBalance: number): number {
  return roundCap(startingBalance);
}

/** Precio de la startup según el monto acumulado de la sala, acotado a los límites configurados. */
export function getMarketPrice(totalRaised: number): number {
  const raw = EVENT_CONFIG.priceBase + totalRaised / EVENT_CONFIG.priceStepCoins;
  const bounded = Math.min(EVENT_CONFIG.priceMax, Math.max(EVENT_CONFIG.priceMin, raw));
  return Math.round(bounded);
}

/** Valida un monto contra el mínimo, el tope y el saldo. Devuelve null si es válido. */
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
