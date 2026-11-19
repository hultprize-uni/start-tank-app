import { requireOperator, noSessionResponse } from "@/server/auth/code-session";
import { API_OPERATOR_ACTIONS, executeOperatorAction, type ApiOperatorAction } from "@/lib/db/queries";
import { readJsonBody, errorResponse, jsonResponse } from "@/server/http/responses";

function isAction(value: unknown): value is ApiOperatorAction {
  return typeof value === "string" && (API_OPERATOR_ACTIONS as readonly string[]).includes(value);
}

/**
 * Ejecuta una acción de control de ronda en nombre del operador. Solo la sesión del rol operador
 * puede invocar esta ruta: un jurado recibe 401 aunque conozca la URL. Las transiciones se validan
 * en las funciones SQL y cada acción válida queda registrada en accion_ronda.
 */
export async function POST(request: Request) {
  try {
    const session = await requireOperator();

    const body = await readJsonBody(request);
    const action = body?.action;
    if (!isAction(action)) {
      return errorResponse(400, "INVALID_ACTION");
    }

    const result = await executeOperatorAction(session.id, action);
    if (!result.ok) {
      return errorResponse(409, result.error ?? "ACTION_REJECTED");
    }
    return jsonResponse({ ok: true, state: result.state ?? null });
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}
