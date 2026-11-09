import { requireOperator, respuestaSinSesion } from "@/lib/auth/code-session";
import { buildSettlementCsv } from "@/lib/api/operator.export";
import { leerVistaOperador } from "@/lib/db/queries";
import { ENCABEZADOS_SIN_CACHE, respuestaError } from "@/lib/http/respuestas";

/** Marca de orden de bytes para que Excel reconozca la codificación UTF-8. */
const UTF8_BOM = "﻿";

/**
 * Exporta en CSV los saldos de los asistentes y sus posiciones por ronda. El archivo se entrega
 * como descarga solo a la sesión del rol operador.
 */
export async function GET() {
  try {
    await requireOperator();
    const vista = await leerVistaOperador();
    if (vista === null) {
      return respuestaError(404, "SIN_RONDAS");
    }

    const fecha = new Date().toISOString().slice(0, 10);
    return new Response(UTF8_BOM + buildSettlementCsv(vista), {
      status: 200,
      headers: {
        ...ENCABEZADOS_SIN_CACHE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="liquidacion-${fecha}.csv"`,
      },
    });
  } catch (error) {
    const sinSesion = respuestaSinSesion(error);
    if (sinSesion !== null) return sinSesion;
    throw error;
  }
}
