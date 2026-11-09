/*
 * Formato numerico de la pantalla. Se usa la convencion de la especificacion:
 * separador de miles con coma y decimal con punto.
 */

const formatoEntero = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const formatoDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea una cantidad entera de Impact Coins o de personas. */
export function formatearEntero(valor: number): string {
  return formatoEntero.format(valor);
}

/** Formatea un multiplicador con dos decimales, por ejemplo "1.27 x". */
export function formatearMultiplicador(valor: number): string {
  return `${formatoDecimal.format(valor)} x`;
}

/** Formatea una fraccion entre 0 y 1 como porcentaje entero, por ejemplo "67 %". */
export function formatearPorcentaje(fraccion: number): string {
  return `${Math.round(fraccion * 100)} %`;
}
