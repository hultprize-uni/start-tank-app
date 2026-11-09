import { errorInversionista } from "@/lib/api/investor.errors";
import { getInvestorSession } from "@/lib/auth/investor";
import { leerEstadoInversionista } from "@/lib/db/investor-queries";
import { respuestaJson } from "@/lib/http/respuestas";

/*
 * Estado del portal del inversionista. La identidad proviene solo de la sesión de Neon Auth; la
 * ruta no acepta identificadores del cliente.
 */
export const dynamic = "force-dynamic";

/** Devuelve el InvestorViewModel del asistente de la sesión vigente, o 401 sin sesión. */
export async function GET() {
  const sesion = await getInvestorSession();
  if (sesion === null) {
    const error = errorInversionista("SIN_SESION");
    return respuestaJson({ error: error.codigo, mensaje: error.mensaje }, error.estado);
  }

  const vista = await leerEstadoInversionista(sesion.idUsuario);
  return respuestaJson(vista);
}
