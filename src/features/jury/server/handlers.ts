import type { Decision } from "@/shared/domain/types";
import { readAccessCode } from "@/server/auth/access-code";
import { noSessionResponse, requireJury, startSession } from "@/server/auth/code-session";
import { sql } from "@/server/db/client";
import { normalizeFunctionResult } from "@/server/db/values";
import {
  errorResponse,
  jsonResponse,
  readJsonBody,
  stateResponse,
} from "@/server/http/responses";
import { findJurorByCode, readJuryView, registerVote } from "./queries";

/**
 * Guarda en el borrador la nota de un criterio de la ronda en curso (RF-15). Cuerpo:
 * { criterionId: string, value: 1..5 }. Responde { ok: true } o un error 409 con el código.
 */
export async function handleJuryDraft(request: Request): Promise<Response> {
  try {
    const session = await requireJury();
    const body = await readJsonBody(request);
    const criterionId = body?.criterionId;
    const value = body?.value;
    if (
      typeof criterionId !== "string" ||
      !/^\d+$/.test(criterionId) ||
      typeof value !== "number" ||
      !Number.isInteger(value)
    ) {
      return errorResponse(400, "INVALID_NOTE");
    }

    const [round] = await sql<{ id_ronda: string }>`
      select id_ronda::text as id_ronda
        from ronda
       where estado in ('ABIERTA', 'ULTIMA_LLAMADA', 'CERRADA', 'EN_VOTACION')
       order by numero
       limit 1`;
    if (round === undefined) {
      return errorResponse(409, "ROUND_NOT_GRADABLE");
    }

    const [row] = await sql<{ resultado: Record<string, unknown> }>`
      select fn_guardar_borrador(${session.id}::bigint, ${round.id_ronda}::bigint,
                                 ${criterionId}::bigint, ${value}::int) as resultado`;
    const result = normalizeFunctionResult(row?.resultado ?? {});
    return result.ok ? jsonResponse({ ok: true }) : errorResponse(409, result.error ?? "DRAFT_REJECTED");
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}

/** Decisiones admitidas para el voto del jurado. */
const DECISIONS: readonly Decision[] = ["BACK", "REJECT", "ABSTAIN"];

function isDecision(value: unknown): value is Decision {
  return typeof value === "string" && (DECISIONS as readonly string[]).includes(value);
}

/**
 * Valida el código de acceso del jurado contra la tabla jurado y, si coincide, establece la cookie
 * de sesión del rol jurado.
 */
export async function handleJuryLogin(request: Request): Promise<Response> {
  const code = await readAccessCode(request);
  if (code === null) {
    return errorResponse(400, "CODE_REQUIRED");
  }

  const juror = await findJurorByCode(code);
  if (juror === null) {
    return errorResponse(401, "INVALID_CODE");
  }

  const response = jsonResponse({ ok: true, name: juror.nombre });
  await startSession(response, "jury", juror.id);
  return response;
}

/** Devuelve el view model del portal del jurado para la sesión vigente. */
export async function handleJuryState(): Promise<Response> {
  try {
    const session = await requireJury();
    // Latido de conexión (RF-26): la función escribe como máximo una vez cada 15 segundos.
    const [view] = await Promise.all([
      readJuryView(session.id),
      sql`select fn_latido_jurado(${session.id}::bigint)`,
    ]);
    if (view === null) {
      return errorResponse(401, "INVALID_SESSION");
    }
    return stateResponse(view);
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}

/**
 * Registra el voto definitivo del jurado en la ronda activa. La validación de estado, de unicidad
 * del voto y de existencia del jurado se realiza en fn_registrar_voto.
 */
export async function handleJuryVote(request: Request): Promise<Response> {
  try {
    const session = await requireJury();

    const body = await readJsonBody(request);
    const decision = body?.decision;
    if (!isDecision(decision)) {
      return errorResponse(400, "INVALID_DECISION");
    }

    const result = await registerVote(session.id, decision);
    if (!result.ok) {
      return errorResponse(409, result.error ?? "VOTE_REJECTED");
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}
