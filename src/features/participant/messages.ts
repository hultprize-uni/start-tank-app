import { EVENT_CONFIG } from "@/shared/domain/config";
import type { InvestmentIssue } from "./rules";

/*
 * Textos de interfaz del portal del participante que se comparten entre componentes y la simulación.
 * Los textos son visibles para el asistente y se redactan en español.
 */

/** Mensaje mostrado cuando el mercado ya no admite inversiones. */
export const MARKET_CLOSED_MESSAGE = "El mercado ya cerró.";

/** Mensaje mostrado cuando una actualización del estado no se completa. */
export const UPDATE_FAILED_MESSAGE = "No fue posible actualizar la ronda. Reintentando.";

/** Texto del aviso que confirma una inversión, seguido del monto descontado. */
export function investmentConfirmedMessage(formattedAmount: string): string {
  return `Inversión confirmada · −${formattedAmount}`;
}

/**
 * Texto de error para un monto que no cumple las reglas. El tope se formatea por el llamador para
 * conservar el separador de miles del portal.
 */
export function describeInvestmentIssue(issue: InvestmentIssue, formattedRemainingCap: string): string {
  switch (issue) {
    case "below-min":
      return `El mínimo es ${EVENT_CONFIG.minInvestment.toLocaleString("en-US")} coins.`;
    case "above-cap":
      return `Tu tope en esta ronda es ${formattedRemainingCap}.`;
    case "above-balance":
      return "Saldo insuficiente.";
  }
}
