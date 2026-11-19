import { API_ROUTES } from "@/shared/lib/api-routes";
import type { ParticipantViewModel, InvestmentResult } from "../types";

/*
 * Llamadas HTTP del portal del inversionista. Reciben la función fetch como parámetro para que las
 * pruebas la sustituyan sin tocar el entorno global. Ninguna función lanza error por fallos de red
 * en la inversión: los devuelve como resultado con mensaje para mostrarlo al asistente.
 */

/** Señal de sesión ausente: la API responde 401 cuando el asistente no ha ingresado. */
export const NO_SESSION = "NO_SESSION" as const;

/** Respuesta del estado: el view model o la señal de sesión ausente. */
export type StateResponse = ParticipantViewModel | typeof NO_SESSION;

/** Función de solicitud HTTP compatible con fetch. */
export type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

const NETWORK_MESSAGE = "No fue posible conectar con el servidor. Intenta de nuevo.";
const INVESTMENT_FAILED_MESSAGE = "No fue posible registrar la inversión. Intenta de nuevo.";

/**
 * Obtiene el estado del inversionista. Devuelve SIN_SESION ante un 401 y lanza error ante cualquier
 * otro estado de fallo, para que el llamador conserve el último view model válido.
 */
export async function fetchParticipantState(
  fetchFn: FetchFunction = fetch,
): Promise<StateResponse> {
  const response = await fetchFn(API_ROUTES.participant.state, { cache: "no-store" });
  if (response.status === 401) {
    return NO_SESSION;
  }
  if (!response.ok) {
    throw new Error(`El estado del inversionista respondió ${response.status}`);
  }
  return (await response.json()) as ParticipantViewModel;
}

/**
 * Envía el monto de la inversión. Solo se transmite el monto: el servidor identifica al asistente
 * por su sesión. Los errores de la API se devuelven con el mensaje que indica el servidor.
 */
export async function investAmount(
  amount: number,
  fetchFn: FetchFunction = fetch,
): Promise<InvestmentResult> {
  try {
    const response = await fetchFn(API_ROUTES.participant.invest, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as
      | { message?: unknown }
      | null;
    if (response.ok) {
      return { ok: true };
    }
    return {
      ok: false,
      message: typeof body?.message === "string" ? body.message : INVESTMENT_FAILED_MESSAGE,
    };
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
}
