import { sql } from "../db/client.ts";
import { runInitialLoadFromFile } from "./carga-inicial.ts";
import { runCloseEvent } from "./cierre-evento.ts";
import { exportStatistics } from "./estadisticas.ts";
import { exportPositions } from "./exportar-posiciones.ts";
import { runRehearsalReset } from "./reinicio-ensayo.ts";
import { backupToFile, restoreFromFile } from "./respaldo.ts";

/* Procesos batch disponibles en `pnpm batch <proceso> [argumento]` (WORKPLAN F7). */

/** El CLI actúa como el primer conductor registrado: las funciones SQL exigen ese rol. */
async function conductorId(): Promise<string> {
  const [row] = await sql<{ id: string }>`
    select id_operador::text as id from operador where rol = 'CONDUCTOR' order by id_operador limit 1`;
  if (!row) throw new Error("No hay ningún operador con rol CONDUCTOR.");
  return row.id;
}

export const PROCESSES: Record<string, { help: string; run: (arg?: string) => Promise<unknown> }> = {
  "carga-inicial": {
    help: "LOAD del evento desde un JSON (ver db/carga-inicial.example.json). Argumento: ruta.",
    run: async (path) => {
      if (!path) throw new Error("Indica el archivo: pnpm batch carga-inicial db/carga-inicial.json");
      return runInitialLoadFromFile(path);
    },
  },
  cierre: { help: "Cierre del evento: puntaje final, ganadora, top 3 y mejor ojo.", run: async () => runCloseEvent(await conductorId()) },
  ensayo: { help: "Reinicio del modo ensayo, con respaldo previo. Bloqueado con el evento iniciado.", run: async () => runRehearsalReset(await conductorId()) },
  posiciones: { help: "Exporta saldos y posiciones del último corte a CSV.", run: exportPositions },
  estadisticas: { help: "Exporta las estadísticas del evento a JSON.", run: exportStatistics },
  respaldo: { help: "Backup: UNLOAD de todas las tablas a JSON.", run: () => backupToFile() },
  restaurar: { help: "Restore del último respaldo, o del archivo indicado.", run: (path) => restoreFromFile(path) },
  reconstruir: {
    help: "Recalcula leaderboard y startup_leaderboard desde los movimientos.",
    run: async () => (await sql<{ resultado: unknown }>`select fn_reconstruir_leaderboard() as resultado`)[0].resultado,
  },
  mantenimiento: {
    help: "Reconstruye los índices y actualiza las estadísticas de las tablas. Después del evento.",
    run: async () => {
      await sql`
        do $$
        declare t text;
        begin
          foreach t in array fn_tablas_respaldo() loop
            execute format('reindex table %I', t);
            execute format('analyze %I', t);
          end loop;
        end $$`;
      return { ok: true };
    },
  },
};
