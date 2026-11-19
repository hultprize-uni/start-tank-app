/*
 * Formato numerico de la pantalla. Se usa la convencion de la especificacion:
 * separador de miles con coma y decimal con punto.
 */

const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const priceFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const decimalFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea una cantidad entera de Impact Coins o de personas. */
export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

/** Formatea el precio vivo de una startup con un decimal, por ejemplo "148.5". */
export function formatPrice(value: number): string {
  return priceFormat.format(value);
}

/** Formatea un multiplicador con dos decimales, por ejemplo "1.27 x". */
export function formatMultiplier(value: number): string {
  return `${decimalFormat.format(value)} x`;
}

/** Formatea una fraccion entre 0 y 1 como porcentaje entero, por ejemplo "67 %". */
export function formatPercentage(fraction: number): string {
  return `${Math.round(fraction * 100)} %`;
}
