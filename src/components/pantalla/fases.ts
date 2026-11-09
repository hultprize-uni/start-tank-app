import type { ScreenPhase } from "@/lib/api/screen.types";

/** Orden de las fases en la jornada y etiqueta de cada una en el encabezado. */
export const FASES_PANTALLA: { valor: ScreenPhase; etiqueta: string }[] = [
  { valor: "MERCADO", etiqueta: "Mercado abierto" },
  { valor: "ULTIMA_LLAMADA", etiqueta: "Última llamada" },
  { valor: "VOTACION", etiqueta: "Votación" },
  { valor: "LIQUIDACION", etiqueta: "Liquidación" },
  { valor: "ENTRE_RONDAS", etiqueta: "Entre rondas" },
  { valor: "CIERRE", etiqueta: "Cierre del evento" },
];

/** Interpreta el valor del parametro `fase` de la URL. Devuelve undefined si no corresponde a una fase. */
export function parsearFase(valor: string | undefined): ScreenPhase | undefined {
  return FASES_PANTALLA.find((fase) => fase.valor === valor)?.valor;
}

/** Etiqueta de una fase para el encabezado y el selector. */
export function etiquetaFase(valor: ScreenPhase): string {
  return FASES_PANTALLA.find((fase) => fase.valor === valor)?.etiqueta ?? valor;
}
