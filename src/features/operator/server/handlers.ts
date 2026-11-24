import { readAccessCode } from "@/server/auth/access-code";
import { startSession } from "@/server/auth/code-session";
import {
  NO_CACHE_HEADERS,
  errorResponse,
  jsonResponse,
  readJsonBody,
  stateResponse,
} from "@/server/http/responses";
import { buildSettlementCsv } from "../api/export";
import { toBalanceRow, toPositionRow } from "./mappers";
import {
  ACTIONS_WITH_REASON,
  API_OPERATOR_ACTIONS,
  executeManualSettlement,
  executeOperatorAction,
  findOperatorByCode,
  readExportRows,
  readOperatorView,
  type ApiOperatorAction,
} from "./queries";
import { readReason, withConductor, withOperator } from "./session";

/** Marca de orden de bytes para que Excel reconozca la codificación UTF-8. */
const UTF8_BOM = "﻿";

function isAction(value: unknown): value is ApiOperatorAction {
  return typeof value === "string" && (API_OPERATOR_ACTIONS as readonly string[]).includes(value);
}

/** Estado HTTP de un código de negocio: falta de permiso 403, el resto 409. */
function businessStatus(code: string): number {
  return code === "FORBIDDEN" ? 403 : 409;
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

/** Devuelve el view model de la consola, con la hora del servidor, para la sesión vigente. */
export function handleOperatorState(): Promise<Response> {
  return withOperator(async (operatorId) => {
    const view = await readOperatorView(operatorId);
    if (view === null) {
      return errorResponse(404, "NO_ROUNDS");
    }
    return stateResponse(view);
  });
}

/**
 * Ejecuta una acción de ronda: POST { action, reason? }. Solo el conductor (RF-05). Las anulaciones
 * exigen motivo (RF-10); REVEAL con motivo revela con los jurados presentes (RF-18). Las
 * transiciones se validan en SQL y cada acción válida queda en accion_ronda con su motivo (RF-09).
 */
export function handleOperatorAction(request: Request): Promise<Response> {
  return withConductor(async (operatorId) => {
    const body = await readJsonBody(request);
    const action = body?.action;
    if (!isAction(action)) {
      return errorResponse(400, "INVALID_ACTION");
    }
    const reason = readReason(body?.reason);
    if (ACTIONS_WITH_REASON.has(action) && reason === null) {
      return errorResponse(400, "REASON_REQUIRED");
    }

    const result = await executeOperatorAction(operatorId, action, reason);
    if (!result.ok) {
      const code = result.error ?? "ACTION_REJECTED";
      return errorResponse(businessStatus(code), code);
    }
    return jsonResponse({
      ok: true,
      state: result.state ?? null,
      multiplier: result.multiplier ?? null,
    });
  });
}

/** Puntaje mínimo y máximo que acepta la liquidación manual. */
const MIN_MANUAL_SCORE = 1;
const MAX_MANUAL_SCORE = 5;

/**
 * Liquida la ronda en curso a mano: POST { score, reason }. El puntaje de 1 a 5 lo cuenta el
 * conductor; el motivo es obligatorio. Los códigos de fn_liquidar_manual se devuelven tal cual.
 */
export function handleOperatorManualSettlement(request: Request): Promise<Response> {
  return withConductor(async (operatorId) => {
    const body = await readJsonBody(request);
    const score = body?.score;
    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < MIN_MANUAL_SCORE ||
      score > MAX_MANUAL_SCORE
    ) {
      return errorResponse(400, "PUNTAJE_INVALIDO");
    }
    const reason = readReason(body?.reason);
    if (reason === null) {
      return errorResponse(400, "MOTIVO_REQUERIDO");
    }

    const result = await executeManualSettlement(operatorId, score, reason);
    if (result.ok !== true) {
      const code = typeof result.error === "string" ? result.error : "ACCION_RECHAZADA";
      return errorResponse(code === "SIN_PERMISO" ? 403 : 409, code);
    }
    return jsonResponse(result);
  });
}

/**
 * Exporta en CSV los saldos y las posiciones de los asistentes (RF-31). Es una lectura: la puede
 * descargar el conductor y el soporte.
 */
export function handleOperatorExport(): Promise<Response> {
  return withOperator(async () => {
    const rows = await readExportRows();
    const csv = buildSettlementCsv({
      balances: rows.balances.map(toBalanceRow),
      positions: rows.positions.map(toPositionRow),
    });

    const date = new Date().toISOString().slice(0, 10);
    return new Response(UTF8_BOM + csv, {
      status: 200,
      headers: {
        ...NO_CACHE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="saldos-posiciones-${date}.csv"`,
      },
    });
  });
}
