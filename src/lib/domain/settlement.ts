/** Redondea un monto a centavos para eliminar el ruido de punto flotante. */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calcula el retorno de una inversión liquidada: monto invertido x multiplicador
 * de la ronda. El precio de compra y el precio de cierre no intervienen.
 */
export function settle(amount: number, multiplier: number): number {
  return roundCents(amount * multiplier);
}

/**
 * Actualiza el saldo del asistente al liquidar una inversión. El monto invertido
 * ya fue descontado al comprar, por lo que la liquidación acredita el retorno completo.
 * La idempotencia de la liquidación se garantiza en la capa de base de datos.
 */
export function applySettlement(balance: number, amount: number, multiplier: number): number {
  return roundCents(balance + settle(amount, multiplier));
}
