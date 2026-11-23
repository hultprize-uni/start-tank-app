import { jsonResponse, readJsonBody, stateResponse } from "@/server/http/responses";
import { participantError } from "./errors";
import { readParticipantState, registerInvestment } from "./queries";
import { getParticipantSession } from "./session";

/** Respuesta de error con código, mensaje en español y estado HTTP derivados del código. */
function participantErrorResponse(code: string): Response {
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
 * Estado del portal del participante. La identidad proviene solo de la sesión de Neon Auth; la
 * ruta no acepta identificadores del cliente.
 */

/** Devuelve el ParticipantViewModel del asistente de la sesión vigente, o 401 sin sesión. */
export async function handleParticipantState(): Promise<Response> {
  const session = await getParticipantSession();
  if (session === null) {
    return participantErrorResponse("NO_SESSION");
  }

  return stateResponse(await readParticipantState(session.userId));
}

/*
 * Registra una inversión del asistente en la ronda abierta. El identificador del asistente se toma
 * siempre de la sesión (RNF06); cualquier campo de identidad del cuerpo se ignora. Las reglas de
 * monto, tope, saldo y estado de la ronda se validan en fn_registrar_inversion.
 */
export async function handleParticipantInvest(request: Request): Promise<Response> {
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
    const error = participantError(result.error ?? "INTERNAL_ERROR", result.cap);
    return jsonResponse({ error: error.code, message: error.message }, error.status);
  }
  return jsonResponse({ ok: true, balance: result.balance ?? null });
}
