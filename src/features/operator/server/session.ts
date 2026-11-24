import { noSessionResponse, requireOperator } from "@/server/auth/code-session";
import { errorResponse } from "@/server/http/responses";
import { isConductor } from "./queries";

/*
 * Guardas de las rutas del operador (RF-05, RNF-10). Toda ruta exige la cookie del rol operador; las
 * escrituras exigen además el rol CONDUCTOR, de modo que el soporte solo lee aunque conozca la URL.
 * Las funciones SQL repiten la validación del rol como segunda barrera.
 */

/** Ejecuta un handler con la sesión del operador y convierte la falta de sesión en 401. */
export async function withOperator(
  run: (operatorId: string) => Promise<Response>,
): Promise<Response> {
  try {
    const session = await requireOperator();
    return await run(session.id);
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}

/** Como withOperator, pero responde 403 cuando el operador no es conductor. */
export function withConductor(run: (operatorId: string) => Promise<Response>): Promise<Response> {
  return withOperator(async (operatorId) => {
    if (!(await isConductor(operatorId))) return errorResponse(403, "FORBIDDEN");
    return run(operatorId);
  });
}

/** Lee un motivo opcional del cuerpo: texto recortado, o null si falta o está vacío. */
export function readReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, 500);
}
