import { leerPantalla } from "@/lib/db/queries";
import { respuestaError, respuestaJson } from "@/lib/http/respuestas";

/*
 * Ruta pública de solo lectura de la pantalla del evento. No exige sesión y no ejecuta escrituras.
 * La consulta se realiza en cada petición, sin caché, para que el sondeo cada dos segundos refleje
 * el estado vigente.
 */
export const dynamic = "force-dynamic";

/** Devuelve el view model de la pantalla o 404 cuando el evento aún no tiene rondas. */
export async function GET() {
  const pantalla = await leerPantalla();
  if (pantalla === null) {
    return respuestaError(404, "SIN_RONDAS");
  }
  return respuestaJson(pantalla);
}
