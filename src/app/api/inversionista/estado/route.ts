import { participantError } from "@/features/participant/server/errors";
import { getParticipantSession } from "@/features/participant/server/session";
import { readParticipantState } from "@/features/participant/server/queries";
import { jsonResponse } from "@/server/http/responses";

/*
 * Estado del portal del inversionista. La identidad proviene solo de la sesión de Neon Auth; la
 * ruta no acepta identificadores del cliente.
 */
export const dynamic = "force-dynamic";

/** Devuelve el InvestorViewModel del asistente de la sesión vigente, o 401 sin sesión. */
export async function GET() {
  const session = await getParticipantSession();
  if (session === null) {
    const error = participantError("NO_SESSION");
    return jsonResponse({ error: error.code, message: error.message }, error.status);
  }

  const view = await readParticipantState(session.userId);
  return jsonResponse(view);
}
