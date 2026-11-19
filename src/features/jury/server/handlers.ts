import type { Decision } from "@/shared/domain/types";
import { readAccessCode } from "@/server/auth/access-code";
import { noSessionResponse, requireJury, startSession } from "@/server/auth/code-session";
import { errorResponse, jsonResponse, readJsonBody } from "@/server/http/responses";
import { findJurorByCode, readJuryView, registerVote } from "./queries";

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
