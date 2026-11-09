/*
 * Cliente HTTP compartido por los portales del jurado y del operador. Normaliza las respuestas de
 * la API en un resultado discriminado para que los hooks no manejen excepciones de red ni de formato.
 */

/** Resultado de una petición: los datos cuando el estado es 2xx, o el código de error en otro caso. */
export type RespuestaApi<T> =
  | { ok: true; datos: T }
  | { ok: false; estado: number; codigo: string | null; sinConexion: boolean };

interface OpcionesPeticion {
  metodo?: "GET" | "POST";
  cuerpo?: unknown;
}

/** Extrae el código estable de error del cuerpo de una respuesta, si existe. */
async function leerCodigoError(respuesta: Response): Promise<string | null> {
  try {
    const cuerpo: unknown = await respuesta.json();
    if (typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo) {
      const codigo = (cuerpo as { error: unknown }).error;
      return typeof codigo === "string" ? codigo : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Ejecuta una petición JSON contra la API local. Las fallas de red devuelven sinConexion; las
 * respuestas no 2xx devuelven el estado HTTP y el código de error del servidor.
 */
export async function pedirJson<T>(
  ruta: string,
  opciones: OpcionesPeticion = {},
): Promise<RespuestaApi<T>> {
  const conCuerpo = opciones.cuerpo !== undefined;

  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      method: opciones.metodo ?? "GET",
      headers: conCuerpo ? { "Content-Type": "application/json" } : undefined,
      body: conCuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
      cache: "no-store",
    });
  } catch {
    return { ok: false, estado: 0, codigo: null, sinConexion: true };
  }

  if (!respuesta.ok) {
    return {
      ok: false,
      estado: respuesta.status,
      codigo: await leerCodigoError(respuesta),
      sinConexion: false,
    };
  }

  try {
    const datos = (await respuesta.json()) as T;
    return { ok: true, datos };
  } catch {
    return { ok: false, estado: respuesta.status, codigo: null, sinConexion: false };
  }
}

/** Mensaje para fallas de red, en español. */
export const MENSAJE_SIN_CONEXION =
  "No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.";

/** Mensaje genérico para errores del servidor no contemplados, en español. */
export const MENSAJE_SERVIDOR =
  "El servidor no pudo completar la solicitud. Inténtalo de nuevo.";
