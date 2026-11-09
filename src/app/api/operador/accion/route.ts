import { requireOperator, respuestaSinSesion } from "@/lib/auth/code-session";
import { ACCIONES_OPERADOR, ejecutarAccionOperador, type AccionOperador } from "@/lib/db/queries";
import { leerCuerpoJson, respuestaError, respuestaJson } from "@/lib/http/respuestas";

function esAccion(valor: unknown): valor is AccionOperador {
  return typeof valor === "string" && (ACCIONES_OPERADOR as readonly string[]).includes(valor);
}

/**
 * Ejecuta una acción de control de ronda en nombre del operador. Solo la sesión del rol operador
 * puede invocar esta ruta: un jurado recibe 401 aunque conozca la URL. Las transiciones se validan
 * en las funciones SQL y cada acción válida queda registrada en accion_ronda.
 */
export async function POST(request: Request) {
  try {
    const sesion = await requireOperator();

    const cuerpo = await leerCuerpoJson(request);
    const accion = cuerpo?.accion;
    if (!esAccion(accion)) {
      return respuestaError(400, "ACCION_INVALIDA");
    }

    const resultado = await ejecutarAccionOperador(sesion.id, accion);
    if (!resultado.ok) {
      return respuestaError(409, resultado.error ?? "ACCION_RECHAZADA");
    }
    return respuestaJson({ ok: true, estado: resultado.estado ?? null });
  } catch (error) {
    const sinSesion = respuestaSinSesion(error);
    if (sinSesion !== null) return sinSesion;
    throw error;
  }
}
