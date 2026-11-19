import { clearSessionCookie } from "@/server/auth/code-session";
import { jsonResponse } from "@/server/http/responses";

/** Cierre de sesión del jurado. Expira la cookie de sesión del rol jurado; no exige sesión válida. */
export async function POST(): Promise<Response> {
  const response = jsonResponse({ ok: true });
  clearSessionCookie(response, "jury");
  return response;
}
