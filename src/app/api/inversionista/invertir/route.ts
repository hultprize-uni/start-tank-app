import { errorInversionista } from "@/lib/api/investor.errors";
import { getInvestorSession } from "@/lib/auth/investor";
import { registrarInversion } from "@/lib/db/investor-queries";
import { leerCuerpoJson, respuestaJson } from "@/lib/http/respuestas";

export const dynamic = "force-dynamic";

/** Respuesta de error con código, mensaje en español y estado HTTP derivados del código. */
function respuestaErrorInversionista(codigo: string) {
  const error = errorInversionista(codigo);
  return respuestaJson({ error: error.codigo, mensaje: error.mensaje }, error.estado);
}

/** Lee el monto del cuerpo. Solo se aceptan enteros mayores que cero; en otro caso devuelve nulo. */
function leerMonto(cuerpo: Record<string, unknown> | null): number | null {
  const monto = cuerpo?.monto;
  if (typeof monto !== "number" || !Number.isInteger(monto) || monto <= 0) {
    return null;
  }
  return monto;
}

/*
 * Registra una inversión del asistente en la ronda abierta. El identificador del asistente se toma
 * siempre de la sesión (RNF06); cualquier campo de identidad del cuerpo se ignora. Las reglas de
 * monto, tope, saldo y estado de la ronda se validan en fn_registrar_inversion.
 */
export async function POST(request: Request) {
  const sesion = await getInvestorSession();
  if (sesion === null) {
    return respuestaErrorInversionista("SIN_SESION");
  }

  const monto = leerMonto(await leerCuerpoJson(request));
  if (monto === null) {
    return respuestaErrorInversionista("MONTO_INVALIDO");
  }

  const resultado = await registrarInversion(sesion.idUsuario, monto);
  if (!resultado.ok) {
    return respuestaErrorInversionista(resultado.error ?? "ERROR_INTERNO");
  }
  return respuestaJson({ ok: true, saldo: resultado.saldo ?? null });
}
