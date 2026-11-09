import { requireJury, respuestaSinSesion } from "@/lib/auth/code-session";
import { leerVistaJurado } from "@/lib/db/queries";
import { respuestaError, respuestaJson } from "@/lib/http/respuestas";

/** Devuelve el view model del portal del jurado para la sesión vigente. */
export async function GET() {
  try {
    const sesion = await requireJury();
    const vista = await leerVistaJurado(sesion.id);
    if (vista === null) {
      return respuestaError(401, "SESION_NO_VALIDA");
    }
    return respuestaJson(vista);
  } catch (error) {
    const sinSesion = respuestaSinSesion(error);
    if (sinSesion !== null) return sinSesion;
    throw error;
  }
}
