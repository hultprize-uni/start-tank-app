import type { Decision } from "@/lib/domain/types";
import { requireJury, respuestaSinSesion } from "@/lib/auth/code-session";
import { registrarVoto } from "@/lib/db/queries";
import { leerCuerpoJson, respuestaError, respuestaJson } from "@/lib/http/respuestas";

/** Decisiones admitidas para el voto del jurado. */
const DECISIONES: readonly Decision[] = ["RESPALDA", "RECHAZA", "SE_ABSTIENE"];

function esDecision(valor: unknown): valor is Decision {
  return typeof valor === "string" && (DECISIONES as readonly string[]).includes(valor);
}

/**
 * Registra el voto definitivo del jurado en la ronda activa. La validación de estado, de unicidad
 * del voto y de existencia del jurado se realiza en fn_registrar_voto.
 */
export async function POST(request: Request) {
  try {
    const sesion = await requireJury();

    const cuerpo = await leerCuerpoJson(request);
    const decision = cuerpo?.decision;
    if (!esDecision(decision)) {
      return respuestaError(400, "DECISION_INVALIDA");
    }

    const resultado = await registrarVoto(sesion.id, decision);
    if (!resultado.ok) {
      return respuestaError(409, resultado.error ?? "VOTO_RECHAZADO");
    }
    return respuestaJson({ ok: true });
  } catch (error) {
    const sinSesion = respuestaSinSesion(error);
    if (sinSesion !== null) return sinSesion;
    throw error;
  }
}
