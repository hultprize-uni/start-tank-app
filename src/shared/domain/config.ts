/** Parametros del evento. Valores de la especificacion, modificables sin tocar las pantallas (RNF07). */
export const EVENT_CONFIG = {
  initialBalance: 10_000,
  minInvestment: 250,
  roundCapRatio: 0.3,
  priceBase: 100,
  priceMin: 50,
  priceMax: 200,
  /** Monto acumulado de la sala que equivale a una unidad de precio. */
  priceStepCoins: 2_000,
  multiplierBase: 0.2,
  multiplierSlope: 1.6,
  lastCallSeconds: 60,
  winnerWeightJury: 0.6,
  winnerWeightTraction: 0.4,
  investorPollMs: 3_000,
  screenPollMs: 2_000,
} as const;
