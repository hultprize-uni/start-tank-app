import { getNeonAuth } from "@/lib/auth/neon-auth";
import type { NextRequest } from "next/server";

/**
 * Canjea el parámetro neon_auth_session_verifier por la cookie de sesión al volver de Google.
 *
 * La página de inicio es pública: el portal del inversionista muestra su propia pantalla de
 * ingreso. La ruta de login configurada no se utiliza en ningún redireccionamiento y debe
 * diferir de "/", porque el middleware omite el canje cuando la solicitud coincide con ella.
 */
export default function middleware(request: NextRequest) {
  return getNeonAuth().middleware({
    loginUrl: "/ingreso-no-utilizado",
    publicRoutes: ["/"],
  })(request);
}

export const config = {
  matcher: ["/"],
};
