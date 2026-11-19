/** Formatea un monto en coins con separador de miles. */
export function formatCoins(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** Formatea una ganancia o pérdida con signo explícito. */
export function formatSignedCoins(value: number): string {
  if (value > 0) return `+${formatCoins(value)}`;
  if (value < 0) return `−${formatCoins(Math.abs(value))}`;
  return formatCoins(0);
}

/** Formatea una variación de precio con flecha y signo. */
export function formatPriceChange(value: number): string {
  if (value === 0) return "= 0";
  if (value > 0) return `▲ +${value}`;
  return `▼ −${Math.abs(value)}`;
}

/** Formatea un multiplicador con un decimal, por ejemplo "1.4x". */
export function formatMultiplier(value: number): string {
  return `${value.toFixed(1)}x`;
}
