import { clearSessionCookie } from "@/server/auth/code-session";
import { jsonResponse } from "@/server/http/responses";

/** Cierre de sesión del operador. Expira la cookie de sesión del rol operador; no exige sesión válida. */
export async function POST(): Promise<Response> {
  const response = jsonResponse({ ok: true });
  clearSessionCookie(response, "operator");
  return response;
}
