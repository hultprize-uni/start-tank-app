import { participantError } from "@/lib/api/investor.errors";
import { getInvestorSession } from "@/lib/auth/investor";
import { readParticipantState } from "@/lib/db/investor-queries";
import { jsonResponse } from "@/server/http/responses";

/*
 * Estado del portal del inversionista. La identidad proviene solo de la sesión de Neon Auth; la
 * ruta no acepta identificadores del cliente.
 */
export const dynamic = "force-dynamic";

/** Devuelve el InvestorViewModel del asistente de la sesión vigente, o 401 sin sesión. */
export async function GET() {
  const session = await getInvestorSession();
  if (session === null) {
    const error = participantError("NO_SESSION");
    return jsonResponse({ error: error.code, message: error.message }, error.status);
  }

  const view = await readParticipantState(session.userId);
  return jsonResponse(view);
}
