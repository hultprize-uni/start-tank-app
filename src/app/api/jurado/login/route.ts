import { iniciarSesion } from "@/lib/auth/code-session";
import { buscarJuradoPorCodigo } from "@/lib/db/queries";
import { leerCuerpoJson, respuestaError, respuestaJson } from "@/lib/http/respuestas";

/** Longitud máxima admitida para un código de acceso. */
const LONGITUD_MAXIMA_CODIGO = 64;

/**
 * Valida el código de acceso del jurado contra la tabla jurado y, si coincide, establece la cookie
 * de sesión del rol jurado.
 */
export async function POST(request: Request) {
  const cuerpo = await leerCuerpoJson(request);
  const valor = cuerpo?.codigo;
  const codigo = typeof valor === "string" ? valor.trim() : "";

  if (codigo.length === 0 || codigo.length > LONGITUD_MAXIMA_CODIGO) {
    return respuestaError(400, "CODIGO_REQUERIDO");
  }

  const jurado = await buscarJuradoPorCodigo(codigo);
  if (jurado === null) {
    return respuestaError(401, "CODIGO_INVALIDO");
  }

  const respuesta = respuestaJson({ ok: true, nombre: jurado.nombre });
  await iniciarSesion(respuesta, "jurado", jurado.id);
  return respuesta;
}
