import type { Decision } from "@/shared/domain/types";
import { requireJury, noSessionResponse } from "@/lib/auth/code-session";
import { registerVote } from "@/lib/db/queries";
import { readJsonBody, errorResponse, jsonResponse } from "@/lib/http/respuestas";

/** Decisiones admitidas para el voto del jurado. */
const DECISIONS: readonly Decision[] = ["BACK", "REJECT", "ABSTAIN"];

function isDecision(value: unknown): value is Decision {
  return typeof value === "string" && (DECISIONS as readonly string[]).includes(value);
}

/**
 * Registra el voto definitivo del jurado en la ronda activa. La validación de estado, de unicidad
 * del voto y de existencia del jurado se realiza en fn_registrar_voto.
 */
export async function POST(request: Request) {
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
