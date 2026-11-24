import { API_ROUTES } from "@/shared/lib/api-routes";
import { OFFLINE_MESSAGE, SERVER_ERROR_MESSAGE, requestJson } from "@/shared/lib/http-client";
import { USE_MOCKS } from "@/shared/lib/env";
import type { EventCloseSummary } from "@/shared/domain/types";
import { mockServer } from "./mock";
import type {
  AttendeeSearchView,
  CancelMode,
  ConfigUpdate,
  ConfigView,
  HealthView,
  OperatorActionId,
  OperatorViewModel,
  PreflightView,
  TimerCommand,
} from "../types";

/*
 * Cliente de la consola del operador. Cada función devuelve un resultado discriminado con el
 * mensaje en español; con NEXT_PUBLIC_USE_MOCKS=true responde el servidor de muestra en memoria
 * (api/mock.ts), que aplica las mismas reglas que la API.
 */

/** Mensaje cuando la sesión del operador ha dejado de ser válida. */
export const OPERATOR_SESSION_EXPIRED_MESSAGE =
  "Tu sesión venció. Verifica el código de acceso para continuar.";

const INVALID_OPERATOR_CODE_MESSAGE =
  "El código no es válido. Verifica el código de acceso del operador.";

/** Resultado de una operación del portal del operador. */
export type OperatorResult<T = null> =
  | { ok: true; value: T }
  | { ok: false; sessionExpired: boolean; message: string };

/** Mensajes en español de los códigos de error de la API y de las funciones SQL. */
export const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_ACTION: "La acción solicitada no es válida.",
  ROUND_UNAVAILABLE: "No hay una ronda disponible para esta acción.",
  ROUND_NOT_FOUND: "No hay una ronda disponible para esta acción.",
  NO_ROUNDS: "No hay rondas configuradas para el evento.",
  TRANSITION_NOT_ALLOWED: "La acción no está permitida en el estado actual de la ronda.",
  ANOTHER_ROUND_ACTIVE: "Ya hay otra ronda en curso. Termínala o anúlala antes de abrir esta.",
  PREVIOUS_ROUND_PENDING: "La ronda anterior aún no está liquidada ni anulada.",
  ROUND_NOT_VOTING: "La ronda no está en votación.",
  PENDING_VOTES: "Faltan jurados por enviar. Revelar se habilita con los 4 envíos.",
  NO_JURORS: "No hay jurados registrados.",
  NO_VOTES_CAST: "Ningún jurado envió notas. La ronda no puede revelarse.",
  OPERATOR_NOT_FOUND: "Tu acceso ya no es válido. Verifica el código de acceso del operador.",
  FORBIDDEN: "Tu rol es de soporte: solo puedes consultar. Las acciones las ejecuta el conductor.",
  SIN_PERMISO: "Tu rol es de soporte: solo puedes consultar. Las acciones las ejecuta el conductor.",
  REASON_REQUIRED: "Escribe el motivo: queda en el log de acciones.",
  MOTIVO_REQUERIDO: "Escribe el motivo: queda en el log de acciones.",
  ALREADY_PAUSED: "La fase ya está en pausa.",
  NOT_PAUSED: "La fase no está en pausa.",
  NO_TIMER: "Esta fase no tiene cronómetro.",
  USER_NOT_FOUND: "No se encontró al asistente.",
  NEGATIVE_BALANCE: "El ajuste dejaría el saldo por debajo de cero.",
  INVALID_AMOUNT: "El monto del ajuste no puede ser cero.",
  INVALID_BODY: "Revisa los datos del formulario.",
  ROUND_OPEN: "Hay una ronda en curso: la configuración se edita entre rondas.",
  INVALID_CONFIG_KEY: "Ese parámetro no se puede editar.",
  INVALID_CONFIG_VALUE: "El valor está fuera del rango permitido.",
  PRICE_RANGE_INVALID: "El precio mínimo debe ser menor que el máximo.",
  MIN_ABOVE_CAPITAL: "La compra mínima no puede superar el capital inicial.",
  INVALID_CRITERIA: "Cada criterio necesita nombre, frases de referencia y un peso mayor que 0.",
  WEIGHTS_NOT_ONE: "Los pesos de los criterios deben sumar 100%.",
  CODE_TAKEN: "Ese código ya lo usa otro jurado.",
  NOT_FOUND: "El registro ya no existe.",
  EVENT_ALREADY_STARTED: "El evento ya está iniciado.",
  PREFLIGHT_NOT_READY: "Faltan puntos del checklist en verde.",
  EVENT_STARTED: "El evento ya está iniciado: el modo ensayo está bloqueado.",
  ROUNDS_PENDING: "Aún hay rondas sin liquidar ni anular.",
  NOT_IMPLEMENTED: "El proceso batch aún no está disponible en este entorno (F7).",
  PUNTAJE_INVALIDO: "El puntaje debe estar entre 1 y 5.",
  RONDA_YA_LIQUIDADA: "La ronda ya fue liquidada.",
  RONDA_NO_DISPONIBLE: "La ronda no está cerrada ni en votación.",
  RONDA_NO_EXISTE: "No hay una ronda disponible para liquidar.",
  OPERADOR_NO_EXISTE: "Tu acceso ya no es válido. Verifica el código de acceso del operador.",
};

/** Respuesta normalizada que comparten la API real y el servidor de muestra. */
type Raw<T> = { ok: true; data: T } | { ok: false; status: number; code: string | null; offline: boolean };

function toResult<T, U = T>(response: Raw<T>, map: (data: T) => U): OperatorResult<U> {
  if (response.ok) return { ok: true, value: map(response.data) };
  if (response.offline) return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: OPERATOR_SESSION_EXPIRED_MESSAGE };
  }
  const message =
    (response.code !== null ? ERROR_MESSAGES[response.code] : undefined) ?? SERVER_ERROR_MESSAGE;
  return { ok: false, sessionExpired: false, message };
}

function get<T>(route: string): Promise<Raw<T>> {
  return requestJson<T>(route);
}

function post<T>(route: string, body?: unknown): Promise<Raw<T>> {
  return requestJson<T>(route, { method: "POST", body });
}

/** Valida el código del operador y establece la cookie de sesión. Devuelve el mensaje de error o null. */
export async function loginOperator(code: string): Promise<string | null> {
  const response = USE_MOCKS
    ? mockServer.login(code)
    : await post<{ ok: boolean; name: string }>(API_ROUTES.operator.login, { code });
  if (response.ok) return null;
  if (response.offline) return OFFLINE_MESSAGE;
  if (response.code === "INVALID_CODE") return INVALID_OPERATOR_CODE_MESSAGE;
  if (response.code === "CODE_REQUIRED") return "Ingresa el código de acceso.";
  return SERVER_ERROR_MESSAGE;
}

/** Cierra la sesión del operador en el servidor. Un fallo de red no impide volver al acceso. */
export async function logoutOperator(): Promise<void> {
  if (USE_MOCKS) {
    mockServer.logout();
    return;
  }
  await post<{ ok: boolean }>(API_ROUTES.operator.logout);
}

/** Lee el view model completo de la consola para la sesión vigente. */
export async function readOperatorState(): Promise<OperatorResult<OperatorViewModel>> {
  const response = USE_MOCKS
    ? mockServer.state()
    : await get<OperatorViewModel>(API_ROUTES.operator.state);
  return toResult(response, (data) => data);
}

/** Comando de la consola sobre la ronda en curso. */
export type OperatorCommand =
  | { type: "step"; id: OperatorActionId }
  | { type: "timer"; command: TimerCommand }
  | { type: "rescue"; reason: string }
  | { type: "cancel"; mode: CancelMode; reason: string };

const STEP_ACTIONS: Record<OperatorActionId, string> = {
  open: "OPEN",
  last_call: "LAST_CALL",
  close: "CLOSE",
  enable_voting: "ENABLE_VOTING",
  reveal: "REVEAL",
};

const TIMER_ACTIONS: Record<TimerCommand, string> = {
  pause: "PAUSE",
  resume: "RESUME",
  add_minute: "ADD_MINUTE",
};

/** Cuerpo de POST /api/operator/action para un comando. */
export function actionBody(command: OperatorCommand): { action: string; reason?: string } {
  switch (command.type) {
    case "step":
      return { action: STEP_ACTIONS[command.id] };
    case "timer":
      return { action: TIMER_ACTIONS[command.command] };
    case "rescue":
      return { action: "REVEAL", reason: command.reason };
    case "cancel":
      return {
        action: command.mode === "refund" ? "CANCEL_REFUND" : "CANCEL_SETTLE_1X",
        reason: command.reason,
      };
  }
}

/** Ejecuta un comando sobre la ronda. La validación de la transición la hace el servidor. */
export async function runOperatorCommand(
  command: OperatorCommand,
): Promise<OperatorResult<{ multiplier: number | null }>> {
  const body = actionBody(command);
  const response = USE_MOCKS
    ? mockServer.action(body.action, body.reason ?? null)
    : await post<{ ok: boolean; multiplier?: number | null }>(API_ROUTES.operator.action, body);
  return toResult(response, (data) => ({ multiplier: data.multiplier ?? null }));
}

/** Liquida a mano la ronda en curso con el puntaje contado por el conductor (1 a 5). */
export async function submitManualSettlement(
  score: number,
  reason: string,
): Promise<OperatorResult<{ multiplier: number }>> {
  const response = USE_MOCKS
    ? mockServer.manualSettlement(score, reason)
    : await post<{ ok: boolean; multiplicador?: number | string }>(
        API_ROUTES.operator.manualSettlement,
        { score, reason },
      );
  return toResult(response, (data) => ({ multiplier: Number(data.multiplicador ?? 0) }));
}

export async function readHealth(): Promise<OperatorResult<HealthView>> {
  const response = USE_MOCKS ? mockServer.health() : await get<HealthView>(API_ROUTES.operator.health);
  return toResult(response, (data) => data);
}

export async function searchAttendees(query: string): Promise<OperatorResult<AttendeeSearchView>> {
  const response = USE_MOCKS
    ? mockServer.attendees(query)
    : await get<AttendeeSearchView>(
        `${API_ROUTES.operator.attendees}?q=${encodeURIComponent(query)}`,
      );
  return toResult(response, (data) => data);
}

/** Ajusta el saldo de un asistente con motivo obligatorio (RF-11). Devuelve el saldo nuevo. */
export async function adjustBalance(
  userId: string,
  amount: number,
  reason: string,
): Promise<OperatorResult<{ balance: number | null }>> {
  const response = USE_MOCKS
    ? mockServer.balance(userId, amount, reason)
    : await post<{ ok: boolean; balance: number | null }>(API_ROUTES.operator.balance, {
        userId,
        amount,
        reason,
      });
  return toResult(response, (data) => ({ balance: data.balance ?? null }));
}

export async function setManualMode(
  enabled: boolean,
  reason: string | null,
): Promise<OperatorResult> {
  const response = USE_MOCKS
    ? mockServer.manualMode(enabled, reason)
    : await post<{ ok: boolean }>(API_ROUTES.operator.manualMode, { enabled, reason });
  return toResult(response, () => null);
}

export async function readConfig(): Promise<OperatorResult<ConfigView>> {
  const response = USE_MOCKS ? mockServer.config() : await get<ConfigView>(API_ROUTES.operator.config);
  return toResult(response, (data) => data);
}

export async function updateConfig(update: ConfigUpdate): Promise<OperatorResult> {
  const response = USE_MOCKS
    ? mockServer.updateConfig(update)
    : await post<{ ok: boolean }>(API_ROUTES.operator.config, update);
  return toResult(response, () => null);
}

export async function readPreflight(): Promise<OperatorResult<PreflightView>> {
  const response = USE_MOCKS
    ? mockServer.preflight()
    : await get<PreflightView>(API_ROUTES.operator.preflight);
  return toResult(response, (data) => data);
}

/** Inicia el evento: solo con el checklist en verde (RF-29). */
export async function startEvent(): Promise<OperatorResult> {
  const response = USE_MOCKS
    ? mockServer.startEvent()
    : await post<{ ok: boolean }>(API_ROUTES.operator.preflight);
  return toResult(response, () => null);
}

/** Reinicia los datos de ensayo. Se rechaza con el evento iniciado (RF-29). */
export async function resetRehearsal(): Promise<OperatorResult> {
  const response = USE_MOCKS
    ? mockServer.rehearsal()
    : await post<{ ok: boolean }>(API_ROUTES.operator.rehearsal);
  return toResult(response, () => null);
}

/** Cierra el evento y devuelve la ganadora, el top 3 y el mejor ojo (RF-30). */
export async function closeEvent(): Promise<OperatorResult<EventCloseSummary>> {
  const response = USE_MOCKS
    ? mockServer.closeEvent()
    : await post<EventCloseSummary>(API_ROUTES.operator.closeEvent);
  return toResult(response, (data) => data);
}

/** Descarga el CSV de saldos y posiciones (RF-31). */
export async function downloadExport(): Promise<OperatorResult> {
  if (USE_MOCKS) {
    mockServer.downloadCsv();
    return { ok: true, value: null };
  }

  let response: Response;
  try {
    response = await fetch(API_ROUTES.operator.export, { cache: "no-store" });
  } catch {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: OPERATOR_SESSION_EXPIRED_MESSAGE };
  }
  if (!response.ok) {
    return { ok: false, sessionExpired: false, message: SERVER_ERROR_MESSAGE };
  }

  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  const matched = contentDisposition.match(/filename="([^"]+)"/);
  const name = matched?.[1] ?? "saldos-posiciones.csv";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { ok: true, value: null };
}
