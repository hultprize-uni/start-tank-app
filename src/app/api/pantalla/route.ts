import { readScreen } from "@/lib/db/queries";
import { errorResponse, jsonResponse } from "@/lib/http/respuestas";

/*
 * Ruta pública de solo lectura de la pantalla del evento. No exige sesión y no ejecuta escrituras.
 * La consulta se realiza en cada petición, sin caché, para que el sondeo cada dos segundos refleje
 * el estado vigente.
 */
export const dynamic = "force-dynamic";

/** Devuelve el view model de la pantalla o 404 cuando el evento aún no tiene rondas. */
export async function GET() {
  const screen = await readScreen();
  if (screen === null) {
    return errorResponse(404, "NO_ROUNDS");
  }
  return jsonResponse(screen);
}
