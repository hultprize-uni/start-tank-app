import { readJsonBody } from "@/server/http/responses";

/** Longitud máxima admitida para un código de acceso. */
const MAX_CODE_LENGTH = 64;

/**
 * Lee el código de acceso del cuerpo de la petición. Devuelve nulo cuando falta, está vacío o
 * supera la longitud máxima.
 */
export async function readAccessCode(request: Request): Promise<string | null> {
  const body = await readJsonBody(request);
  const value = body?.code;
  const code = typeof value === "string" ? value.trim() : "";
  if (code.length === 0 || code.length > MAX_CODE_LENGTH) {
    return null;
  }
  return code;
}
