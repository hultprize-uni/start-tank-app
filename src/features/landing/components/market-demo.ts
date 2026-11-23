/*
 * Serie simulada del mercado de la portada. Las funciones son puras y deterministas: el primer
 * render del servidor y el del cliente producen el mismo resultado.
 */

/** Subidas del monto de la sala en cada inversión simulada, en puntos de precio. */
const STEPS = [1.4, 0.9, 2.6, 1.1, 3.2, 0.8, 2.2, 1.7, 2.9, 1.3, 2.4, 3.1, 1.6, 2.0];

/** Escalones visibles al empezar; la curva crece uno por tick hasta completarse y vuelve a empezar. */
const START_STEPS = 5;

export interface MarketFrame {
  /** Precio en vivo con un decimal, por ejemplo "128.4". */
  price: string;
  /** Variación frente a 100, por ejemplo "+28.4". */
  delta: string;
  /** Polilínea escalonada en el sistema de coordenadas de 100 x 30. */
  line: string;
  /** La misma polilínea cerrada por abajo, para el relleno. */
  area: string;
}

/** Cuadro de la demo para un tick: la curva escalonada sube con cada inversión. */
export function marketFrame(tick: number): MarketFrame {
  const visible = START_STEPS + (tick % (STEPS.length - START_STEPS + 1));
  const levels = [0];
  for (let k = 0; k < visible; k += 1) levels.push(levels[k] + STEPS[k]);

  const total = STEPS.reduce((sum, step) => sum + step, 0);
  const x = (k: number) => ((k / STEPS.length) * 100).toFixed(1);
  const y = (level: number) => (29 - (level / total) * 26).toFixed(1);

  const points: string[] = [`0,${y(0)}`];
  for (let k = 1; k < levels.length; k += 1) {
    points.push(`${x(k)},${y(levels[k - 1])}`, `${x(k)},${y(levels[k])}`);
  }
  const last = levels[levels.length - 1];
  points.push(`${x(levels.length)},${y(last)}`);
  const line = points.join(" ");

  return {
    price: (100 + last).toFixed(1),
    delta: `+${last.toFixed(1)}`,
    line,
    area: `${line} ${x(levels.length)},30 0,30`,
  };
}
