import { API_ROUTES } from "@/shared/lib/api-routes";
import { OFFLINE_MESSAGE, SERVER_ERROR_MESSAGE, requestJson } from "@/shared/lib/http-client";
import { USE_MOCKS } from "@/shared/lib/env";
import { verifyOperatorCode } from "./mock";
import type { OperatorActionId, OperatorActionView, OperatorViewModel } from "../types";

/** Mensaje cuando la sesión del operador ha dejado de ser válida. */
export const OPERATOR_SESSION_EXPIRED_MESSAGE =
  "Tu sesión venció. Verifica el código de acceso para continuar.";

const INVALID_OPERATOR_CODE_MESSAGE = "El código no es válido. Verifica el código de acceso del operador.";

const NO_ROUNDS_MESSAGE = "No hay rondas configuradas para el evento.";

const ROUND_NOT_LOADED_MESSAGE = "La ronda aún no se ha cargado. Espera un momento.";

const CANCEL_UNAVAILABLE_MESSAGE = "La ronda no se puede anular en su estado actual.";

const NO_API_EQUIVALENT_MESSAGE = "Esta acción no tiene equivalente en la API.";

/** Acciones que la API acepta en POST /api/operator/action. */
type ApiAction =
  | "OPEN"
  | "LAST_CALL"
  | "CLOSE"
  | "ENABLE_VOTING"
  | "REVEAL"
  | "CANCEL_REFUND"
  | "CANCEL_SETTLE_1X";

/** Solicitud del portal: una acción de la ronda o una de las dos variantes de anulación. */
export type OperatorRequest =
  | OperatorActionId
  | "cancel_refund"
  | "cancel_settle_1x";

/** Resultado de una operación del portal del operador. */
export type OperatorResult<T = null> =
  | { ok: true; value: T }
  | { ok: false; sessionExpired: boolean; message: string };

const ACTION_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_ACTION: "La acción solicitada no es válida.",
  ROUND_UNAVAILABLE: "No hay una ronda disponible para esta acción.",
  ROUND_NOT_FOUND: "No hay una ronda disponible para esta acción.",
  TRANSITION_NOT_ALLOWED: "La acción no está permitida en el estado actual de la ronda.",
  ANOTHER_ROUND_ACTIVE: "Ya hay otra ronda en curso. Cierra o anula esa ronda antes de abrir esta.",
  ROUND_NOT_VOTING: "La ronda no está en votación.",
  PENDING_VOTES: "Faltan votos por emitir. Revelar se habilita cuando voten todos los jurados.",
  NO_JURORS: "No hay jurados registrados.",
  NO_VOTES_CAST: "Ningún jurado ha votado. La ronda no puede revelarse.",
  OPERATOR_NOT_FOUND: "Tu acceso ya no es válido. Verifica el código de acceso del operador.",
};

/** Pasos de API que componen cada solicitud. Cerrar no incluye la habilitación de la votación, que se agrega según la respuesta. */
const STEPS_BY_REQUEST: Readonly<Record<OperatorRequest, readonly ApiAction[]>> = {
  open: ["OPEN"],
  last_call: ["LAST_CALL"],
  close: ["CLOSE"],
  reveal: ["REVEAL"],
  next: [],
  cancel_refund: ["CANCEL_REFUND"],
  cancel_settle_1x: ["CANCEL_SETTLE_1X"],
};

/** Valida el código del operador y establece la cookie de sesión. Devuelve el mensaje de error o null. */
export async function loginOperator(code: string): Promise<string | null> {
  if (USE_MOCKS) {
    return verifyOperatorCode(code) ? null : INVALID_OPERATOR_CODE_MESSAGE;
  }
  const response = await requestJson<{ ok: boolean; name: string }>(API_ROUTES.operator.login, {
    method: "POST",
    body: { code },
  });
  if (response.ok) return null;
  if (response.offline) return OFFLINE_MESSAGE;
  if (response.code === "INVALID_CODE") return INVALID_OPERATOR_CODE_MESSAGE;
  if (response.code === "CODE_REQUIRED") return "Ingresa el código de acceso.";
  return SERVER_ERROR_MESSAGE;
}

/** Lee el view model completo de la consola para la sesión vigente. */
export async function readOperatorState(): Promise<OperatorResult<OperatorViewModel>> {
  const response = await requestJson<OperatorViewModel>(API_ROUTES.operator.state);
  if (response.ok) {
    return { ok: true, value: response.data };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: OPERATOR_SESSION_EXPIRED_MESSAGE };
  }
  if (response.status === 404) {
    return { ok: false, sessionExpired: false, message: NO_ROUNDS_MESSAGE };
  }
  return { ok: false, sessionExpired: false, message: SERVER_ERROR_MESSAGE };
}

/** Envía una acción individual a la API. */
async function sendAction(action: ApiAction) {
  return requestJson<{ ok: boolean; state?: string | null }>(API_ROUTES.operator.action, {
    method: "POST",
    body: { action },
  });
}

/** Traduce un fallo de la API de acciones a un mensaje visible en español. */
function failedResult(response: {
  status: number;
  code: string | null;
  offline: boolean;
}): OperatorResult<never> {
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: OPERATOR_SESSION_EXPIRED_MESSAGE };
  }
  const message =
    (response.code !== null ? ACTION_MESSAGES[response.code] : undefined) ?? SERVER_ERROR_MESSAGE;
  return { ok: false, sessionExpired: false, message };
}

/**
 * Ejecuta una solicitud del operador sobre la ronda que controla. Antes de llamar a la API verifica
 * el estado de la acción en el view model: si está bloqueada, no envía nada y devuelve el motivo.
 * Cerrar envía CLOSE y, si la ronda queda CLOSED, envía ENABLE_VOTING para abrir la votación.
 */
export async function executeOperatorAction(
  request: OperatorRequest,
  view: OperatorViewModel | null,
): Promise<OperatorResult> {
  if (view === null) {
    return { ok: false, sessionExpired: false, message: ROUND_NOT_LOADED_MESSAGE };
  }

  if (request === "cancel_refund" || request === "cancel_settle_1x") {
    if (!view.canCancel) {
      return { ok: false, sessionExpired: false, message: CANCEL_UNAVAILABLE_MESSAGE };
    }
  } else {
    const action: OperatorActionView | undefined = view.actions.find(
      (candidata) => candidata.id === request,
    );
    if (action === undefined || !action.enabled) {
      const message =
        action?.blockedReason ?? "La acción no está disponible en el estado actual de la ronda.";
      return { ok: false, sessionExpired: false, message };
    }
  }

  const steps = STEPS_BY_REQUEST[request];
  if (steps.length === 0) {
    return { ok: false, sessionExpired: false, message: NO_API_EQUIVALENT_MESSAGE };
  }

  for (const step of steps) {
    const response = await sendAction(step);
    if (!response.ok) {
      return failedResult(response);
    }
    if (step === "CLOSE" && response.data.state === "CLOSED") {
      const enablement = await sendAction("ENABLE_VOTING");
      if (!enablement.ok) {
        return failedResult(enablement);
      }
    }
  }
  return { ok: true, value: null };
}

/** Cierra la sesión del operador en el servidor. Un fallo de red no impide volver al acceso. */
export async function logoutOperator(): Promise<void> {
  if (USE_MOCKS) return;
  await requestJson<{ ok: boolean }>(API_ROUTES.operator.logout, { method: "POST" });
}

/** Mensaje de la liquidación manual con datos de muestra, donde no existe una ronda en el servidor. */
const MANUAL_SAMPLE_MESSAGE = "La liquidación manual no está disponible con datos de muestra.";

/** Traducción de los códigos de negocio de fn_liquidar_manual a mensajes en español. */
const MANUAL_SETTLEMENT_MESSAGES: Readonly<Record<string, string>> = {
  RESPALDOS_INVALIDOS: "La cantidad de respaldos no es válida. Elige un valor entre 0 y 4.",
  RONDA_YA_LIQUIDADA: "La ronda ya fue liquidada. No es posible liquidarla de nuevo.",
  RONDA_NO_DISPONIBLE: "La ronda no está disponible para liquidación en su estado actual.",
  RONDA_NO_EXISTE: "No hay una ronda disponible para liquidar.",
  OPERADOR_NO_EXISTE: "Tu acceso ya no es válido. Verifica el código de acceso del operador.",
};

/** Resultado de una liquidación manual: multiplicador aplicado a las inversiones de la ronda. */
export interface ManualSettlementResult {
  multiplicador: number;
  fraccionRespaldo: number;
}

/**
 * Liquida la ronda activa en modo manual con la cantidad de respaldos indicada (0 a 4). Devuelve el
 * multiplicador aplicado o el motivo del rechazo en español.
 */
export async function submitManualSettlement(
  respaldos: number,
): Promise<OperatorResult<ManualSettlementResult>> {
  if (USE_MOCKS) {
    return { ok: false, sessionExpired: false, message: MANUAL_SAMPLE_MESSAGE };
  }
  const response = await requestJson<{
    ok: boolean;
    multiplicador?: number;
    fraccion_respaldo?: number;
  }>(API_ROUTES.operator.manualSettlement, {
    method: "POST",
    body: { respaldos },
  });
  if (response.ok) {
    return {
      ok: true,
      value: {
        multiplicador: response.data.multiplicador ?? 0,
        fraccionRespaldo: response.data.fraccion_respaldo ?? 0,
      },
    };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: OPERATOR_SESSION_EXPIRED_MESSAGE };
  }
  const message =
    (response.code !== null ? MANUAL_SETTLEMENT_MESSAGES[response.code] : undefined) ??
    SERVER_ERROR_MESSAGE;
  return { ok: false, sessionExpired: false, message };
}

/** Descarga el CSV de saldos y posiciones desde la ruta de exportación. */
export async function downloadExport(): Promise<OperatorResult> {
  let response: Response;
  try {
    response = await fetch(API_ROUTES.operator.export, { cache: "no-store" });
  } catch {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }

  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: OPERATOR_SESSION_EXPIRED_MESSAGE };
  }
  if (response.status === 404) {
    return { ok: false, sessionExpired: false, message: NO_ROUNDS_MESSAGE };
  }
  if (!response.ok) {
    return { ok: false, sessionExpired: false, message: SERVER_ERROR_MESSAGE };
  }

  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  const matched = contentDisposition.match(/filename="([^"]+)"/);
  const name = matched?.[1] ?? "liquidacion.csv";
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
