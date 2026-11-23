import type { Decision } from "@/shared/domain/types";
import { SERVER_ERROR_MESSAGE, OFFLINE_MESSAGE, requestJson } from "@/shared/lib/http-client";
import { API_ROUTES } from "@/shared/lib/api-routes";
import type { ScoreValue } from "../criteria";
import type { JuryViewModel } from "../types";

/** Mensaje cuando la sesión del jurado ha dejado de ser válida. */
export const JURY_SESSION_EXPIRED_MESSAGE = "Tu sesión venció. Ingresa tu código de nuevo.";

const LOGIN_MESSAGES: Readonly<Record<string, string>> = {
  CODE_REQUIRED: "Ingresa tu código de acceso.",
  INVALID_CODE: "Ese código no existe. Revísalo con el equipo organizador e inténtalo de nuevo.",
};

const VOTE_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_DECISION: "Elige una decisión antes de confirmar.",
  ROUND_NOT_FOUND: "No hay una ronda activa para votar.",
  ROUND_NOT_VOTING: "La votación de esta ronda ya no está abierta.",
  DUPLICATE_VOTE: "Ya registraste tu voto en esta ronda.",
  JUROR_NOT_FOUND: "Tu acceso ya no es válido. Ingresa tu código de nuevo.",
};

const DRAFT_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_NOTE: "La nota debe ser un entero entre 1 y 5.",
  CRITERION_NOT_FOUND: "El criterio seleccionado no existe. Recarga la página.",
  ROUND_NOT_GRADABLE: "Esta ronda aún no acepta calificaciones en borrador.",
  ALREADY_SUBMITTED: "Ya enviaste tus notas definitivas en esta ronda.",
  ROUND_NOT_FOUND: "No hay una ronda activa para calificar.",
  JUROR_NOT_FOUND: "Tu acceso ya no es válido. Ingresa tu código de nuevo.",
};

/** Resultado de una operación del portal del jurado. Cuando sessionExpired es true, la sesión debe reiniciarse. */
export type JuryResult<T = null> =
  | { ok: true; value: T }
  | { ok: false; sessionExpired: boolean; message: string };

/** Valida el código de acceso y establece la cookie de sesión del jurado. */
export async function loginJury(code: string): Promise<JuryResult> {
  const response = await requestJson<{ ok: boolean; name: string }>(API_ROUTES.jury.login, {
    method: "POST",
    body: { code },
  });
  if (response.ok) {
    return { ok: true, value: null };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  const message =
    (response.code !== null ? LOGIN_MESSAGES[response.code] : undefined) ?? SERVER_ERROR_MESSAGE;
  return { ok: false, sessionExpired: false, message };
}

/** Lee el view model del portal del jurado para la sesión vigente. */
export async function readJuryState(): Promise<JuryResult<JuryViewModel>> {
  const response = await requestJson<JuryViewModel>(API_ROUTES.jury.state);
  if (response.ok) {
    return { ok: true, value: response.data };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: JURY_SESSION_EXPIRED_MESSAGE };
  }
  return { ok: false, sessionExpired: false, message: SERVER_ERROR_MESSAGE };
}

/** Guarda en la base de datos la nota en borrador de un criterio (RF-14). */
export async function saveJuryDraft(criterionId: string, value: ScoreValue): Promise<JuryResult> {
  const response = await requestJson<{ ok: boolean }>(API_ROUTES.jury.draft, {
    method: "POST",
    body: { criterionId, value },
  });
  if (response.ok) {
    return { ok: true, value: null };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: JURY_SESSION_EXPIRED_MESSAGE };
  }
  const message =
    (response.code !== null ? DRAFT_MESSAGES[response.code] : undefined) ?? SERVER_ERROR_MESSAGE;
  return { ok: false, sessionExpired: false, message };
}

/** Registra el voto definitivo del jurado en la ronda activa. */
export async function voteJury(decision: Decision): Promise<JuryResult> {
  const response = await requestJson<{ ok: boolean }>(API_ROUTES.jury.vote, {
    method: "POST",
    body: { decision },
  });
  if (response.ok) {
    return { ok: true, value: null };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: JURY_SESSION_EXPIRED_MESSAGE };
  }
  const message =
    (response.code !== null ? VOTE_MESSAGES[response.code] : undefined) ?? SERVER_ERROR_MESSAGE;
  return { ok: false, sessionExpired: false, message };
}

/**
 * Cierra la sesión del jurado y expira la cookie. El portal vuelve al acceso con independencia del
 * resultado, por lo que un fallo de red no impide salir.
 */
export async function logoutJury(): Promise<JuryResult> {
  const response = await requestJson<{ ok: boolean }>(API_ROUTES.jury.logout, { method: "POST" });
  if (response.ok) {
    return { ok: true, value: null };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  return { ok: false, sessionExpired: false, message: SERVER_ERROR_MESSAGE };
}
