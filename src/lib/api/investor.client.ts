import type { InvestorViewModel, ResultadoInversion } from "./investor.types";

/*
 * Llamadas HTTP del portal del inversionista. Reciben la función fetch como parámetro para que las
 * pruebas la sustituyan sin tocar el entorno global. Ninguna función lanza error por fallos de red
 * en la inversión: los devuelve como resultado con mensaje para mostrarlo al asistente.
 */

/** Ruta del view model del inversionista. */
export const RUTA_ESTADO_INVERSIONISTA = "/api/inversionista/estado";

/** Ruta de registro de inversiones. */
export const RUTA_INVERTIR_INVERSIONISTA = "/api/inversionista/invertir";

/** Señal de sesión ausente: la API responde 401 cuando el asistente no ha ingresado. */
export const SIN_SESION = "SIN_SESION" as const;

/** Respuesta del estado: el view model o la señal de sesión ausente. */
export type RespuestaEstado = InvestorViewModel | typeof SIN_SESION;

/** Función de solicitud HTTP compatible con fetch. */
export type FuncionFetch = (entrada: string, init?: RequestInit) => Promise<Response>;

const MENSAJE_RED = "No fue posible conectar con el servidor. Intenta de nuevo.";
const MENSAJE_INVERSION = "No fue posible registrar la inversión. Intenta de nuevo.";

/**
 * Obtiene el estado del inversionista. Devuelve SIN_SESION ante un 401 y lanza error ante cualquier
 * otro estado de fallo, para que el llamador conserve el último view model válido.
 */
export async function obtenerEstadoInversionista(
  fetchFn: FuncionFetch = fetch,
): Promise<RespuestaEstado> {
  const respuesta = await fetchFn(RUTA_ESTADO_INVERSIONISTA, { cache: "no-store" });
  if (respuesta.status === 401) {
    return SIN_SESION;
  }
  if (!respuesta.ok) {
    throw new Error(`El estado del inversionista respondió ${respuesta.status}`);
  }
  return (await respuesta.json()) as InvestorViewModel;
}

/**
 * Envía el monto de la inversión. Solo se transmite el monto: el servidor identifica al asistente
 * por su sesión. Los errores de la API se devuelven con el mensaje que indica el servidor.
 */
export async function invertirMonto(
  monto: number,
  fetchFn: FuncionFetch = fetch,
): Promise<ResultadoInversion> {
  try {
    const respuesta = await fetchFn(RUTA_INVERTIR_INVERSIONISTA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto }),
      cache: "no-store",
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as
      | { mensaje?: unknown }
      | null;
    if (respuesta.ok) {
      return { ok: true };
    }
    return {
      ok: false,
      mensaje: typeof cuerpo?.mensaje === "string" ? cuerpo.mensaje : MENSAJE_INVERSION,
    };
  } catch {
    return { ok: false, mensaje: MENSAJE_RED };
  }
}
