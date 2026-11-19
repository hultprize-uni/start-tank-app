import { requireOperator, noSessionResponse } from "@/server/auth/code-session";
import { buildSettlementCsv } from "@/features/operator/api/export";
import { readOperatorView } from "@/features/operator/server/queries";
import { NO_CACHE_HEADERS, errorResponse } from "@/server/http/responses";

/** Marca de orden de bytes para que Excel reconozca la codificación UTF-8. */
const UTF8_BOM = "﻿";

/**
 * Exporta en CSV los saldos de los asistentes y sus posiciones por ronda. El archivo se entrega
 * como descarga solo a la sesión del rol operador.
 */
export async function GET() {
  try {
    await requireOperator();
    const view = await readOperatorView();
    if (view === null) {
      return errorResponse(404, "NO_ROUNDS");
    }

    const date = new Date().toISOString().slice(0, 10);
    return new Response(UTF8_BOM + buildSettlementCsv(view), {
      status: 200,
      headers: {
        ...NO_CACHE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="liquidacion-${date}.csv"`,
      },
    });
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}
