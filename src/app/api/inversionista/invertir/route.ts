import { participantError } from "@/lib/api/investor.errors";
import { getParticipantSession } from "@/lib/auth/investor";
import { registerInvestment } from "@/lib/db/investor-queries";
import { readJsonBody, jsonResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

/** Respuesta de error con código, mensaje en español y estado HTTP derivados del código. */
function participantErrorResponse(code: string) {
  const error = participantError(code);
  return jsonResponse({ error: error.code, message: error.message }, error.status);
}

/** Lee el monto del cuerpo. Solo se aceptan enteros mayores que cero; en otro caso devuelve nulo. */
function readAmount(body: Record<string, unknown> | null): number | null {
  const amount = body?.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

/*
 * Registra una inversión del asistente en la ronda abierta. El identificador del asistente se toma
 * siempre de la sesión (RNF06); cualquier campo de identidad del cuerpo se ignora. Las reglas de
 * monto, tope, saldo y estado de la ronda se validan en fn_registrar_inversion.
 */
export async function POST(request: Request) {
  const session = await getParticipantSession();
  if (session === null) {
    return participantErrorResponse("NO_SESSION");
  }

  const amount = readAmount(await readJsonBody(request));
  if (amount === null) {
    return participantErrorResponse("INVALID_AMOUNT");
  }

  const result = await registerInvestment(session.userId, amount);
  if (!result.ok) {
    return participantErrorResponse(result.error ?? "INTERNAL_ERROR");
  }
  return jsonResponse({ ok: true, balance: result.balance ?? null });
}
