/**
 * Parámetros del evento. Son los valores por defecto; en el servidor, la tabla configuracion
 * los reemplaza (ver server/db/config.ts). Las pantallas no escriben estos números a mano (RNF-07).
 */
export const EVENT_CONFIG = {
  initialBalance: 10_000,
  minInvestment: 250,
  roundCapRatio: 0.3,
  priceBase: 100,
  priceMin: 50,
  priceMax: 200,
  /** Monto acumulado de la sala que equivale a una unidad de precio. */
  priceStepCoins: 2_000,
  /** Multiplicador = base + pendiente x ((puntaje - 1) / 4). */
  multiplierBase: 0.2,
  multiplierSlope: 1.6,
  scoreMin: 1,
  scoreMax: 5,
  /** Duración de cada fase de la ronda, en segundos. */
  pitchSeconds: 300,
  qaSeconds: 600,
  lastCallSeconds: 60,
  votingSeconds: 150,
  resultSeconds: 90,
  /** Retraso de la revelación en los teléfonos respecto del escenario, en milisegundos. */
  phoneRevealDelayMs: 3_000,
  /** Peso del jurado y de la participación en el puntaje final de una startup. */
  winnerWeightJury: 0.6,
  winnerWeightTraction: 0.4,
  /** Intervalos de consulta de cada vista, en milisegundos. */
  investorPollMs: 3_000,
  juryPollMs: 3_000,
  screenPollMs: 2_000,
  screenVotingPollMs: 1_000,
} as const;

export type EventConfig = { -readonly [K in keyof typeof EVENT_CONFIG]: number };
