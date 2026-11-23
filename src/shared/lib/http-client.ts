/*
 * Cliente HTTP compartido por los portales del jurado y del operador. Normaliza las respuestas de
 * la API en un resultado discriminado para que los hooks no manejen excepciones de red ni de formato.
 */

import { syncServerClock } from "./use-server-clock";

/** Resultado de una petición: los datos cuando el estado es 2xx, o el código de error en otro caso. */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string | null; offline: boolean };

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

/** Extrae el código estable de error del cuerpo de una respuesta, si existe. */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const code = (body as { error: unknown }).error;
      return typeof code === "string" ? code : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Ejecuta una petición JSON contra la API local. Las fallas de red devuelven offline; las
 * respuestas no 2xx devuelven el estado HTTP y el código de error del servidor.
 */
export async function requestJson<T>(
  route: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const hasBody = options.body !== undefined;

  let response: Response;
  try {
    response = await fetch(route, {
      method: options.method ?? "GET",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, code: null, offline: true };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      code: await readErrorCode(response),
      offline: false,
    };
  }

  try {
    const data = (await response.json()) as T;
    const serverTime = (data as { serverTime?: unknown } | null)?.serverTime;
    if (typeof serverTime === "string") {
      syncServerClock(serverTime);
    }
    return { ok: true, data };
  } catch {
    return { ok: false, status: response.status, code: null, offline: false };
  }
}

/** Mensaje para fallas de red, en español. */
export const OFFLINE_MESSAGE =
  "No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.";

/** Mensaje genérico para errores del servidor no contemplados, en español. */
export const SERVER_ERROR_MESSAGE =
  "El servidor no pudo completar la solicitud. Inténtalo de nuevo.";
