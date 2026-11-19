import { startSession } from "@/server/auth/code-session";
import { findJurorByCode } from "@/lib/db/queries";
import { readJsonBody, errorResponse, jsonResponse } from "@/server/http/responses";

/** Longitud máxima admitida para un código de acceso. */
const MAX_CODE_LENGTH = 64;

/**
 * Valida el código de acceso del jurado contra la tabla jurado y, si coincide, establece la cookie
 * de sesión del rol jurado.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const value = body?.code;
  const code = typeof value === "string" ? value.trim() : "";

  if (code.length === 0 || code.length > MAX_CODE_LENGTH) {
    return errorResponse(400, "CODE_REQUIRED");
  }

  const juror = await findJurorByCode(code);
  if (juror === null) {
    return errorResponse(401, "INVALID_CODE");
  }

  const response = jsonResponse({ ok: true, name: juror.nombre });
  await startSession(response, "jury", juror.id);
  return response;
}
