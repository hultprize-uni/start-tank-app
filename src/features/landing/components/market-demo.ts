/*
 * Serie simulada del mercado que muestra la tarjeta de la portada. Las funciones son puras y
 * deterministas: el primer render del servidor y el del cliente producen el mismo resultado.
 */

/** Startups de muestra que la tarjeta recorre en orden. */
export const DEMO_STARTUPS = [
  { name: "Qhali Agua", ods: "ODS 6, agua limpia y saneamiento" },
  { name: "Tarpuy", ods: "ODS 2, hambre cero" },
  { name: "Pétreo", ods: "ODS 12, consumo responsable" },
] as const;

/** Cuadro de la tarjeta, con cada cifra ya formateada para presentarla. */
export interface MarketFrame {
  price: string;
  delta: string;
  /** Puntos de la polilínea en el sistema de coordenadas de 100 x 28. */
  points: string;
  accumulated: string;
  investors: number;
}

/** Cantidad de puntos de la serie de precio. */
const SERIES_LENGTH = 23;

/** Separa los miles con coma, por ejemplo 6200 se convierte en "6,200". */
export function formatCoins(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Calcula el cuadro de la tarjeta para un instante de la demostración y una startup de muestra. */
export function marketFrame(tick: number, index: number): MarketFrame {
  const series: number[] = [];
  for (let k = 0; k < SERIES_LENGTH; k++) {
    const x = k + tick * 0.6;
    series.push(100 + x * 0.42 + Math.sin(x * 0.7 + index) * 1.8 + Math.sin(x * 0.23) * 1.1);
  }

  const price = series[series.length - 1];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(2, max - min);
  const points = series
    .map((value, k) => {
      const x = ((k / (series.length - 1)) * 100).toFixed(1);
      const y = (27 - ((value - min) / span) * 25).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");

  const accumulated = Math.round(((price - 100) * 2000) / 50) * 50 + 6200;

  return {
    price: price.toFixed(1),
    delta: `+${(price - 100).toFixed(1)}%`,
    points,
    accumulated: formatCoins(Math.round(accumulated)),
    investors: 24 + (Math.round(tick * 1.4) % 46),
  };
}
