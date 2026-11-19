import { readAccessCode } from "@/server/auth/access-code";
import { noSessionResponse, requireOperator, startSession } from "@/server/auth/code-session";
import {
  NO_CACHE_HEADERS,
  errorResponse,
  jsonResponse,
  readJsonBody,
} from "@/server/http/responses";
import { buildSettlementCsv } from "../api/export";
import {
  API_OPERATOR_ACTIONS,
  executeOperatorAction,
  findOperatorByCode,
  readOperatorView,
  type ApiOperatorAction,
} from "./queries";

/** Marca de orden de bytes para que Excel reconozca la codificación UTF-8. */
const UTF8_BOM = "﻿";

function isAction(value: unknown): value is ApiOperatorAction {
  return typeof value === "string" && (API_OPERATOR_ACTIONS as readonly string[]).includes(value);
}

/**
 * Valida el código de acceso del operador contra la tabla operador y, si coincide, establece la
 * cookie de sesión del rol operador. La cookie de jurado no se acepta en las rutas del operador.
 */
export async function handleOperatorLogin(request: Request): Promise<Response> {
  const code = await readAccessCode(request);
  if (code === null) {
    return errorResponse(400, "CODE_REQUIRED");
  }

  const operator = await findOperatorByCode(code);
  if (operator === null) {
    return errorResponse(401, "INVALID_CODE");
  }

  const response = jsonResponse({ ok: true, name: operator.nombre });
  await startSession(response, "operator", operator.id);
  return response;
}

/** Devuelve el view model de la consola del operador para la sesión vigente. */
export async function handleOperatorState(): Promise<Response> {
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

/**
 * Ejecuta una acción de control de ronda en nombre del operador. Solo la sesión del rol operador
 * puede invocar esta ruta: un jurado recibe 401 aunque conozca la URL. Las transiciones se validan
 * en las funciones SQL y cada acción válida queda registrada en accion_ronda.
 */
export async function handleOperatorAction(request: Request): Promise<Response> {
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

/**
 * Exporta en CSV los saldos de los asistentes y sus posiciones por ronda. El archivo se entrega
 * como descarga solo a la sesión del rol operador.
 */
export async function handleOperatorExport(): Promise<Response> {
  try {
    await requireOperator();
    const view = await readOperatorView();
    if (view === null) {
      return errorResponse(404, "NO_ROUNDS");
    }

    const date = new Date().toISOString().slice(0, 10);
    return new Response(UTF8_BOM + buildSettlementCsv(view), {
      status: 200,
      headers: {
        ...NO_CACHE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="liquidacion-${date}.csv"`,
      },
    });
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}
