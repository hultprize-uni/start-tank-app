import type { RoundStatus } from "./types";

/*
 * Umbrales de la consola del operador. Salen del SRS: un jurado se da por desconectado a los 45 s
 * (RF-26), la consulta de estado debe responder en menos de 1 s (RNF-02) y el modo manual se
 * sugiere tras 90 s sin respuesta (RF-27, RNF-08).
 */

/** Estados en que la ronda está en curso. Solo puede haber una ronda así a la vez. */
export const ACTIVE_ROUND_STATUSES: ReadonlySet<RoundStatus> = new Set<RoundStatus>([
  "OPEN",
  "LAST_CALL",
  "CLOSED",
  "VOTING",
]);

/** Un jurado cuenta como conectado si respondió en los últimos 45 segundos (RF-26). */
export const JUROR_ONLINE_SECONDS = 45;

/** Un asistente cuenta como conectado si respondió en los últimos 30 segundos. */
export const ATTENDEE_ONLINE_SECONDS = 30;

/** Latencia de la base a partir de la cual se avisa en ámbar y en rojo, en milisegundos. */
export const DB_LATENCY_WARNING_MS = 500;
export const DB_LATENCY_CRITICAL_MS = 1_000;

/** Fracción de teléfonos conectados bajo la cual se avisa con el mercado abierto. */
export const PHONES_WARNING_RATIO = 0.5;

/** Segundos sin respuesta de la consola a partir de los cuales se avisa y se sugiere el modo manual. */
export const CONSOLE_STALE_SECONDS = 15;
export const MANUAL_MODE_SUGGESTION_SECONDS = 90;

/** Intervalos de consulta de la consola, en milisegundos (ARCHITECTURE.md, sección 3.4). */
export const OPERATOR_POLL_MS = 3_000;
export const HEALTH_POLL_MS = 3_000;
