import { readAccessCode } from "@/server/auth/access-code";
import { noSessionResponse, requireJury, startSession } from "@/server/auth/code-session";
import { sql } from "@/server/db/client";
import {
  errorResponse,
  jsonResponse,
  readJsonBody,
  stateResponse,
} from "@/server/http/responses";
import type { ScoreValue } from "../criteria";
import type { CriterionScoreItem, JuryVotePayload } from "../types";
import { findJurorByCode, readJuryView, registerVote, saveDraftNote } from "./queries";

function parseVotePayload(body: Record<string, unknown> | null): JuryVotePayload | null {
  if (body === null) return null;
  if (body.abstain === true) {
    return { abstain: true };
  }
  if (body.abstain !== undefined && body.abstain !== false) {
    return null;
  }
  if (!Array.isArray(body.notes) || body.notes.length === 0) {
    return null;
  }

  const parsed: CriterionScoreItem[] = [];
  for (const item of body.notes) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return null;
    }
    const candidate = item as { criterionId?: unknown; value?: unknown };
    if (
      typeof candidate.criterionId !== "string" ||
      !/^\d+$/.test(candidate.criterionId) ||
      typeof candidate.value !== "number" ||
      !Number.isInteger(candidate.value) ||
      candidate.value < 1 ||
      candidate.value > 5
    ) {
      return null;
    }
    parsed.push({
      criterionId: candidate.criterionId,
      value: candidate.value as ScoreValue,
    });
  }

  return { abstain: false, notes: parsed };
}

/**
 * Guarda en el borrador la nota de un criterio de la ronda en curso (RF-14). Cuerpo:
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
      !Number.isInteger(value) ||
      value < 1 ||
      value > 5
    ) {
      return errorResponse(400, "INVALID_NOTE");
    }

    const result = await saveDraftNote(session.id, criterionId, value);
    return result.ok ? jsonResponse({ ok: true }) : errorResponse(409, result.error ?? "DRAFT_REJECTED");
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
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
 * Registra el envío definitivo del jurado (notas por criterio o abstención) en la ronda activa.
 * La validación de estado, completitud de criterios y unicidad se realiza en fn_registrar_voto.
 */
export async function handleJuryVote(request: Request): Promise<Response> {
  try {
    const session = await requireJury();

    const body = await readJsonBody(request);
    const payload = parseVotePayload(body);
    if (payload === null) {
      return errorResponse(400, "INVALID_NOTES");
    }

    const result = await registerVote(session.id, payload);
    if (!result.ok) {
      return errorResponse(409, result.error ?? "VOTE_REJECTED");
    }
    return jsonResponse({ ok: true, score: result.score ?? null });
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}
