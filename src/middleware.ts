import { getNeonAuth } from "@/server/auth/neon-auth";
import { PAGE_ROUTES } from "@/shared/lib/api-routes";
import type { NextRequest } from "next/server";

/**
 * Canjea el parámetro neon_auth_session_verifier por la cookie de sesión al volver de Google.
 *
 * El portal del participante es público: muestra su propia pantalla de ingreso. La ruta de login
 * configurada no se utiliza en ningún redireccionamiento y debe diferir de la ruta del portal,
 * porque el middleware omite el canje cuando la solicitud coincide con ella.
 */
export default function middleware(request: NextRequest) {
  return getNeonAuth().middleware({
    loginUrl: "/unused-login",
    publicRoutes: [PAGE_ROUTES.participant],
  })(request);
}

/** El matcher debe ser un literal estático: coincide con PAGE_ROUTES.participant. */
export const config = {
  matcher: ["/participant"],
};
