import { NextResponse } from "next/server";

/*
 * Utilidades compartidas por los route handlers de la API. Las respuestas son dinámicas y no se
 * almacenan en caché intermedia, porque reflejan el estado vigente de la ronda.
 */

/** Encabezados que impiden la caché de las respuestas dinámicas. */
export const NO_CACHE_HEADERS = { "Cache-Control": "no-store" } as const;

/** Respuesta JSON sin caché con el estado HTTP indicado. */
export function jsonResponse(body: unknown, state = 200): NextResponse {
  return NextResponse.json(body, { status: state, headers: NO_CACHE_HEADERS });
}

/**
 * Respuesta de estado de una vista: agrega serverTime con la hora del servidor, que los clientes
 * usan para sincronizar los cronómetros (RNF-15).
 */
export function stateResponse(body: object): NextResponse {
  return jsonResponse({ ...body, serverTime: new Date().toISOString() });
}

/** Respuesta de error con un código estable que el cliente interpreta. */
export function errorResponse(state: number, code: string): NextResponse {
  return jsonResponse({ error: code }, state);
}

/**
 * Lee el cuerpo de la petición como objeto JSON. Devuelve nulo cuando el cuerpo está vacío, no es
 * JSON o no es un objeto.
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
