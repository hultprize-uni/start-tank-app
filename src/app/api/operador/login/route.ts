import { startSession } from "@/server/auth/code-session";
import { findOperatorByCode } from "@/features/operator/server/queries";
import { readJsonBody, errorResponse, jsonResponse } from "@/server/http/responses";

/** Longitud máxima admitida para un código de acceso. */
const MAX_CODE_LENGTH = 64;

/**
 * Valida el código de acceso del operador contra la tabla operador y, si coincide, establece la
 * cookie de sesión del rol operador. La cookie de jurado no se acepta en las rutas del operador.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const value = body?.code;
  const code = typeof value === "string" ? value.trim() : "";

  if (code.length === 0 || code.length > MAX_CODE_LENGTH) {
    return errorResponse(400, "CODE_REQUIRED");
  }

  const operator = await findOperatorByCode(code);
  if (operator === null) {
    return errorResponse(401, "INVALID_CODE");
  }

  const response = jsonResponse({ ok: true, name: operator.nombre });
  await startSession(response, "operator", operator.id);
  return response;
}
