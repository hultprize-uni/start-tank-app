import { EVENT_CONFIG } from "./config";

/** Motivos por los que una inversión es rechazada. */
export type InvestmentRejection =
  | "RONDA_CERRADA"
  | "MINIMO_NO_ALCANZADO"
  | "INSUFFICIENT_BALANCE"
  | "TOPE_DE_RONDA_EXCEDIDO";

export type InvestmentResult = { ok: true } | { ok: false; reason: InvestmentRejection };

export interface InvestmentRequest {
  /** Monto solicitado en Impact Coins. */
  amount: number;
  /** Saldo disponible del asistente en el momento de la compra. */
  balance: number;
  /** Monto que el asistente ya invirtió en la ronda vigente. */
  investedInRound: number;
  /** Saldo del asistente al abrir la ronda, base del tope. */
  balanceAtOpen: number;
  /** Indica si la ronda acepta inversiones. */
  roundOpen: boolean;
}

/** Tope de inversión por ronda: fracción configurada del saldo al abrir la ronda. */
export function roundCap(balanceAtOpen: number): number {
  return balanceAtOpen * EVENT_CONFIG.roundCapRatio;
}

/**
 * Valida una solicitud de compra en el orden: estado de la ronda, monto mínimo,
 * saldo disponible y tope por ronda. Devuelve el primer motivo de rechazo encontrado.
 */
export function validateInvestment(request: InvestmentRequest): InvestmentResult {
  if (!request.roundOpen) {
    return { ok: false, reason: "RONDA_CERRADA" };
  }

  if (request.amount < EVENT_CONFIG.minInvestment) {
    return { ok: false, reason: "MINIMO_NO_ALCANZADO" };
  }

  if (request.amount > request.balance) {
    return { ok: false, reason: "INSUFFICIENT_BALANCE" };
  }

  const total = request.investedInRound + request.amount;
  if (total > roundCap(request.balanceAtOpen)) {
    return { ok: false, reason: "TOPE_DE_RONDA_EXCEDIDO" };
  }

  return { ok: true };
}
