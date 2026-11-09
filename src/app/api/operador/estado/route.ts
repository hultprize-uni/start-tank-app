import { requireOperator, respuestaSinSesion } from "@/lib/auth/code-session";
import { leerVistaOperador } from "@/lib/db/queries";
import { respuestaError, respuestaJson } from "@/lib/http/respuestas";

/** Devuelve el view model de la consola del operador para la sesión vigente. */
export async function GET() {
  try {
    await requireOperator();
    const vista = await leerVistaOperador();
    if (vista === null) {
      return respuestaError(404, "SIN_RONDAS");
    }
    return respuestaJson(vista);
  } catch (error) {
    const sinSesion = respuestaSinSesion(error);
    if (sinSesion !== null) return sinSesion;
    throw error;
  }
}
