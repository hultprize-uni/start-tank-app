import type { JurorStatus, OperatorActionId, RoundStatus } from "./types";

/** Etiquetas visibles de cada estado de ronda. */
export const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
  SCHEDULED: "Programada",
  PITCH: "Pitch",
  OPEN: "Mercado abierto",
  LAST_CALL: "Última llamada",
  CLOSED: "Mercado cerrado",
  VOTING: "Votación",
  SETTLED: "Liquidada",
  CANCELLED: "Anulada",
};

/** Etiqueta corta de cada paso de la ronda, para la línea de pasos. */
export const STEP_LABELS: Record<OperatorActionId, string> = {
  open: "Pitch",
  open_market: "Abrir mercado",
  last_call: "Última llamada",
  close: "Cerrar",
  enable_voting: "Habilitar voto",
  reveal: "Revelar",
};

/** Texto del botón principal para cada paso de la ronda (RF-06). */
export const MAIN_ACTION_LABELS: Record<OperatorActionId, string> = {
  open: "Iniciar pitch",
  open_market: "Terminar pitch y abrir mercado",
  last_call: "Anunciar última llamada",
  close: "Cerrar mercado",
  enable_voting: "Habilitar votación",
  reveal: "Revelar veredicto",
};

/** Estado visible de cada jurado. Nunca incluye la nota antes del veredicto (RNF-11). */
export const JUROR_STATUS_LABELS: Record<JurorStatus, string> = {
  pending: "Pendiente",
  drafting: "Calificando",
  sent: "Enviado",
  abstained: "Sin notas (se abstuvo)",
};

/**
 * Etiquetas de las acciones del log. Incluye los nombres del dominio y los valores que la base
 * guarda sin traducir (REVELAR_PRESENTES, AJUSTE_SALDO y los de administración).
 */
export const OPERATOR_ACTION_LABELS: Readonly<Record<string, string>> = {
  OPEN: "Inició el pitch",
  OPEN_MARKET: "Abrió el mercado",
  RESTART_PHASE: "Reinició el cronómetro de la fase",
  RESTART_ROUND: "Reinició la ronda",
  REINICIAR_EVENTO: "Reinició el evento",
  LAST_CALL: "Anunció la última llamada",
  CLOSE: "Cerró el mercado",
  ENABLE_VOTING: "Habilitó la votación",
  PAUSE: "Pausó la fase",
  RESUME: "Reanudó la fase",
  ADD_MINUTE: "Sumó 1 minuto",
  REVEAL: "Reveló el veredicto",
  REVELAR_PRESENTES: "Reveló con los jurados presentes",
  REVELAR_MANUAL: "Liquidó a mano",
  CANCEL_REFUND: "Anuló la ronda y devolvió lo invertido",
  CANCEL_SETTLE_1X: "Anuló la ronda y liquidó a 1.0x",
  AJUSTE_SALDO: "Ajustó un saldo",
  MODO_MANUAL_ON: "Activó el modo manual",
  MODO_MANUAL_OFF: "Desactivó el modo manual",
  CONFIGURACION: "Cambió la configuración",
  INICIAR_EVENTO: "Inició el evento",
};

/** Etiqueta visible de una acción del log; las desconocidas se muestran tal cual. */
export function actionLabel(action: string): string {
  return OPERATOR_ACTION_LABELS[action] ?? action;
}

/** Formatea montos en Impact Coins con separador de miles. */
export function formatCoins(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Formatea un monto con signo, por ejemplo +500 o -1,200. */
export function formatSignedCoins(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCoins(Math.abs(value))}`;
}

/**
 * Formatea un multiplicador con hasta dos decimales y sin ceros finales: 1.4 se muestra como
 * 1.4x, 1.27 como 1.27x y 1 como 1x.
 */
export function formatMultiplier(value: number): string {
  return `${Number(value.toFixed(2))}x`;
}

/** Formatea un puntaje del jurado de 1 a 5, por ejemplo 4.25. */
export function formatJuryScore(value: number): string {
  return `${Number(value.toFixed(2))}`;
}

/** Formatea segundos como m:ss, por ejemplo 0:45. Los valores negativos se tratan como cero. */
export function formatSeconds(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Formatea segundos como mm:ss con dos dígitos en los minutos, para el cronómetro grande. */
export function formatClock(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Zona horaria del evento. */
export const EVENT_TIME_ZONE = "America/Lima";

const TIME_FORMAT = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: EVENT_TIME_ZONE,
});

const SHORT_TIME_FORMAT = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: EVENT_TIME_ZONE,
});

/** Hora HH:MM:SS en la zona del evento. */
export function formatTime(date: Date): string {
  return TIME_FORMAT.format(date);
}

/** Hora HH:MM en la zona del evento. */
export function formatShortTime(date: Date): string {
  return SHORT_TIME_FORMAT.format(date);
}

/** Texto de "hace N s" o "hace N min" para la última conexión. */
export function formatAgo(seconds: number | null): string {
  if (seconds === null) return "Sin conexión registrada";
  if (seconds < 60) return `hace ${Math.max(0, Math.round(seconds))} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)} h`;
}

/**
 * Texto del adelanto o atraso del evento. Menos de un minuto de diferencia se considera a tiempo.
 */
export function formatScheduleDelta(deltaSeconds: number): string {
  const minutes = Math.round(Math.abs(deltaSeconds) / 60);
  if (minutes === 0) return "Evento a tiempo";
  return deltaSeconds > 0 ? `Evento ${minutes} min atrasado` : `Evento ${minutes} min adelantado`;
}
