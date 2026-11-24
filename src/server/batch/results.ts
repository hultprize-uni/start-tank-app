import { EVENT_CONFIG } from "../../shared/domain/config.ts";
import type { EventCloseSummary } from "../../shared/domain/types.ts";

/*
 * Pasos SORT del cierre del evento (DATABASE.md, sección 4). Función pura: recibe lo extraído en
 * el UNLOAD y devuelve el orden y el resumen. El LOAD lo hace fn_cargar_resultados.
 */

export interface StartupResultRow {
  id_ronda: string;
  nombre: string;
  /** Promedio del jurado, de 1 a 5. Nulo en una ronda anulada. */
  puntaje_jurado: number | null;
  inversores_unicos: number;
}

export interface InvestorResultRow {
  id_usuario: string;
  nombre: string;
  saldo: number;
  aciertos: number;
}

export interface RankedStartup extends StartupResultRow {
  investorShare: number;
  finalScore: number;
}

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

/** Puntaje final: 0.6 × ((puntaje del jurado − 1) / 4) + 0.4 × (inversores ÷ asistentes). */
export function finalScore(juryScore: number | null, investors: number, attendees: number): number {
  const span = EVENT_CONFIG.scoreMax - EVENT_CONFIG.scoreMin;
  const jury = juryScore === null ? 0 : (juryScore - EVENT_CONFIG.scoreMin) / span;
  const share = attendees > 0 ? investors / attendees : 0;
  return round4(EVENT_CONFIG.winnerWeightJury * jury + EVENT_CONFIG.winnerWeightTraction * share);
}

/**
 * Ordena las startups por puntaje final (empate: mayor puntaje del jurado) y los asistentes por
 * saldo. La primera startup gana, los 3 primeros asistentes son el top 3 y el mejor ojo es quien
 * más aciertos tiene (empate: el de mejor posición).
 */
export function computeEventResults(
  startups: readonly StartupResultRow[],
  investors: readonly InvestorResultRow[],
  attendees: number,
  closedAt: Date,
): { ranked: RankedStartup[]; summary: EventCloseSummary } {
  const ranked = startups
    .map((row) => ({
      ...row,
      investorShare: attendees > 0 ? round4(row.inversores_unicos / attendees) : 0,
      finalScore: finalScore(row.puntaje_jurado, row.inversores_unicos, attendees),
    }))
    .sort((a, b) => b.finalScore - a.finalScore || (b.puntaje_jurado ?? 0) - (a.puntaje_jurado ?? 0));

  const byBalance = [...investors].sort(
    (a, b) => b.saldo - a.saldo || Number(a.id_usuario) - Number(b.id_usuario),
  );
  const eye = byBalance.reduce<InvestorResultRow | null>(
    (best, row) => (best === null || row.aciertos > best.aciertos ? row : best),
    null,
  );
  const winner = ranked[0];

  return {
    ranked,
    summary: {
      closedAt: closedAt.toISOString(),
      winnerStartup: winner
        ? {
            name: winner.nombre,
            juryScore: winner.puntaje_jurado ?? 0,
            investorShare: winner.investorShare,
            finalScore: winner.finalScore,
          }
        : null,
      topInvestors: byBalance.slice(0, 3).map((row) => ({
        name: row.nombre,
        balance: row.saldo,
        hits: row.aciertos,
      })),
      bestEye: eye && eye.aciertos > 0 ? { name: eye.nombre, hits: eye.aciertos } : null,
    },
  };
}
