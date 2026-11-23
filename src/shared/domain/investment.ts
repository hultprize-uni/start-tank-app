import { EVENT_CONFIG } from "./config";

/**
 * Motivos de rechazo de una inversión, con los mismos códigos que devuelve
 * fn_registrar_inversion, para que el cliente y el servidor hablen igual.
 */
export type InvestmentRejection =
  | "RONDA_NO_ABIERTA"
  | "MERCADO_EN_PAUSA"
  | "YA_INVIRTIO"
  | "MONTO_MINIMO"
  | "TOPE_RONDA_SUPERADO"
  | "SALDO_INSUFICIENTE";

export type InvestmentResult = { ok: true } | { ok: false; reason: InvestmentRejection };

export interface InvestmentRequest {
  /** Monto solicitado en Impact Coins. */
  amount: number;
  /** Saldo disponible del asistente. Como invierte una sola vez por ronda, es la base del tope. */
  balance: number;
  /** Indica si el asistente ya invirtió en la ronda vigente. */
  alreadyInvested: boolean;
  /** Indica si la ronda acepta inversiones (abierta o en última llamada vigente). */
  roundOpen: boolean;
  paused: boolean;
}

/** Tope de inversión de la ronda: 30 % del saldo, redondeado a centavos como en SQL. */
export function roundCap(balance: number): number {
  return Math.round(balance * EVENT_CONFIG.roundCapRatio * 100) / 100;
}

/**
 * Valida una inversión en el mismo orden que fn_registrar_inversion: monto mínimo, ronda abierta,
 * pausa, inversión previa, tope y saldo. Devuelve el primer motivo de rechazo.
 */
export function validateInvestment(request: InvestmentRequest): InvestmentResult {
  if (request.amount < EVENT_CONFIG.minInvestment) {
    return { ok: false, reason: "MONTO_MINIMO" };
  }
  if (!request.roundOpen) {
    return { ok: false, reason: "RONDA_NO_ABIERTA" };
  }
  if (request.paused) {
    return { ok: false, reason: "MERCADO_EN_PAUSA" };
  }
  if (request.alreadyInvested) {
    return { ok: false, reason: "YA_INVIRTIO" };
  }
  if (request.amount > roundCap(request.balance)) {
    return { ok: false, reason: "TOPE_RONDA_SUPERADO" };
  }
  if (request.amount > request.balance) {
    return { ok: false, reason: "SALDO_INSUFICIENTE" };
  }
  return { ok: true };
}

/** Lo que recibiría el asistente con cada puntaje entero del jurado, de 1 a 5 (RF-24). */
export function payoutPreview(
  amount: number,
  multiplierForScore: (score: number) => number,
): { score: number; multiplier: number; payout: number }[] {
  return [1, 2, 3, 4, 5].map((score) => {
    const multiplier = multiplierForScore(score);
    return { score, multiplier, payout: Math.round(amount * multiplier * 100) / 100 };
  });
}
