import type { EventCloseSummary } from "../../shared/domain/types.ts";
import { sql } from "../db/client.ts";
import { exportPositions } from "./exportar-posiciones.ts";
import { writeOutput } from "./io.ts";
import { restoreSnapshot, takeSnapshot } from "./respaldo.ts";
import { computeEventResults, type InvestorResultRow, type StartupResultRow } from "./results.ts";

/*
 * Cierre del evento (DATABASE.md, sección 4; RF-30): evalúa rondas, UNLOAD, SORT y LOAD. Si el
 * LOAD falla, RESTORE de la copia del UNLOAD y un reintento.
 */

export type CloseEventResult = { ok: true; summary: EventCloseSummary } | { ok: false; error: string };

async function load(operatorId: string, ranked: { id_ronda: string; finalScore: number }[]) {
  const payload = JSON.stringify(ranked.map((row) => ({ id_ronda: row.id_ronda, puntaje: row.finalScore })));
  const [row] = await sql<{ resultado: { ok: boolean; error?: string } }>`
    select fn_cargar_resultados(${operatorId}::bigint, ${payload}::jsonb) as resultado`;
  return row.resultado;
}

export async function runCloseEvent(operatorId: string, now: Date = new Date()): Promise<CloseEventResult> {
  // 1. Evalúa rondas.
  const rounds = await sql<{ estado: string }>`select estado from ronda`;
  if (rounds.length === 0 || rounds.some((r) => r.estado !== "LIQUIDADA" && r.estado !== "ANULADA")) {
    return { ok: false, error: "RONDAS_PENDIENTES" };
  }

  // 2. UNLOAD, con la copia de respaldo para el RESTORE.
  const [startups, investors, attendees, snapshot] = await Promise.all([
    sql<{ id_ronda: string; nombre: string; puntaje_jurado: string | null; inversores_unicos: number }>`
      select r.id_ronda::text as id_ronda, s.nombre,
             sl.puntaje_jurado::text as puntaje_jurado,
             coalesce(sl.inversores_unicos, 0) as inversores_unicos
        from ronda r
        join startup s on s.id_startup = r.id_startup
        left join startup_leaderboard sl on sl.id_ronda = r.id_ronda`,
    sql<{ id_usuario: string; nombre: string; saldo: string; aciertos: number }>`
      select u.id_usuario::text as id_usuario,
             coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
             u.saldo_actual::text as saldo,
             coalesce(l.aciertos, 0) as aciertos
        from usuario u
        left join leaderboard l on l.id_usuario = u.id_usuario
         and l.id_ronda = (select id_ronda from ronda order by numero desc limit 1)`,
    sql<{ total: number }>`select count(*)::int as total from usuario`,
    takeSnapshot(),
  ]);
  // La copia a archivo es best effort: sin disco escribible queda la copia en memoria.
  await writeOutput("respaldo-cierre", "json", JSON.stringify(snapshot)).catch(() => undefined);

  // 3. SORT.
  const { ranked, summary } = computeEventResults(
    startups.map<StartupResultRow>((row) => ({
      ...row,
      puntaje_jurado: row.puntaje_jurado === null ? null : Number(row.puntaje_jurado),
    })),
    investors.map<InvestorResultRow>((row) => ({ ...row, saldo: Number(row.saldo) })),
    attendees[0]?.total ?? 0,
    now,
  );

  // 4. LOAD, con RESTORE y un reintento ante un fallo técnico.
  let result: { ok: boolean; error?: string };
  try {
    result = await load(operatorId, ranked);
  } catch {
    await restoreSnapshot(snapshot);
    result = await load(operatorId, ranked);
  }
  if (!result.ok) {
    return { ok: false, error: result.error ?? "LOAD_FAILED" };
  }

  await exportPositions().catch(() => undefined);
  return { ok: true, summary };
}
