import { iniciarSesion } from "@/lib/auth/code-session";
import { buscarOperadorPorCodigo } from "@/lib/db/queries";
import { leerCuerpoJson, respuestaError, respuestaJson } from "@/lib/http/respuestas";

/** Longitud máxima admitida para un código de acceso. */
const LONGITUD_MAXIMA_CODIGO = 64;

/**
 * Valida el código de acceso del operador contra la tabla operador y, si coincide, establece la
 * cookie de sesión del rol operador. La cookie de jurado no se acepta en las rutas del operador.
 */
export async function POST(request: Request) {
  const cuerpo = await leerCuerpoJson(request);
  const valor = cuerpo?.codigo;
  const codigo = typeof valor === "string" ? valor.trim() : "";

  if (codigo.length === 0 || codigo.length > LONGITUD_MAXIMA_CODIGO) {
    return respuestaError(400, "CODIGO_REQUERIDO");
  }

  const operador = await buscarOperadorPorCodigo(codigo);
  if (operador === null) {
    return respuestaError(401, "CODIGO_INVALIDO");
  }

  const respuesta = respuestaJson({ ok: true, nombre: operador.nombre });
  await iniciarSesion(respuesta, "operador", operador.id);
  return respuesta;
}
