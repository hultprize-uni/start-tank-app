import { requireJury, noSessionResponse } from "@/server/auth/code-session";
import { readJuryView } from "@/lib/db/queries";
import { errorResponse, jsonResponse } from "@/server/http/responses";

/** Devuelve el view model del portal del jurado para la sesión vigente. */
export async function GET() {
  try {
    const session = await requireJury();
    const view = await readJuryView(session.id);
    if (view === null) {
      return errorResponse(401, "INVALID_SESSION");
    }
    return jsonResponse(view);
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}
