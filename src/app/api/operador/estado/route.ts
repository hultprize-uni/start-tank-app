import { requireOperator, noSessionResponse } from "@/server/auth/code-session";
import { readOperatorView } from "@/lib/db/queries";
import { errorResponse, jsonResponse } from "@/server/http/responses";

/** Devuelve el view model de la consola del operador para la sesión vigente. */
export async function GET() {
  try {
    await requireOperator();
    const view = await readOperatorView();
    if (view === null) {
      return errorResponse(404, "NO_ROUNDS");
    }
    return jsonResponse(view);
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}
