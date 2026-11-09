import { NextResponse } from "next/server";

/*
 * Utilidades compartidas por los route handlers de la API. Las respuestas son dinámicas y no se
 * almacenan en caché intermedia, porque reflejan el estado vigente de la ronda.
 */

/** Encabezados que impiden la caché de las respuestas dinámicas. */
export const ENCABEZADOS_SIN_CACHE = { "Cache-Control": "no-store" } as const;

/** Respuesta JSON sin caché con el estado HTTP indicado. */
export function respuestaJson(cuerpo: unknown, estado = 200): NextResponse {
  return NextResponse.json(cuerpo, { status: estado, headers: ENCABEZADOS_SIN_CACHE });
}

/** Respuesta de error con un código estable que el cliente interpreta. */
export function respuestaError(estado: number, codigo: string): NextResponse {
  return respuestaJson({ error: codigo }, estado);
}

/**
 * Lee el cuerpo de la petición como objeto JSON. Devuelve nulo cuando el cuerpo está vacío, no es
 * JSON o no es un objeto.
 */
export async function leerCuerpoJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const cuerpo: unknown = await request.json();
    if (typeof cuerpo === "object" && cuerpo !== null && !Array.isArray(cuerpo)) {
      return cuerpo as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
