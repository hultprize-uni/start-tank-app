import { sql } from "../db/client.ts";
import { backupToFile } from "./respaldo.ts";

/*
 * Reinicio del modo ensayo (RF-29) y reinicio total del evento. Primero el respaldo a archivo: si
 * no se puede escribir, no se borra nada. El ensayo llama a fn_reiniciar_ensayo, que se niega con
 * el evento iniciado; el reinicio total (full) llama a fn_reiniciar_evento, que no tiene ese bloqueo
 * y además apaga las banderas del evento.
 */
export async function runRehearsalReset(
  operatorId: string,
  full = false,
): Promise<{ ok: true; backup: string } | { ok: false; error: string }> {
  let backup: string;
  try {
    backup = await backupToFile(full ? "respaldo-reinicio-evento" : "respaldo-ensayo");
  } catch {
    return { ok: false, error: "BACKUP_FAILED" };
  }
  const [row] = full
    ? await sql<{ resultado: { ok: boolean; error?: string } }>`
        select fn_reiniciar_evento(${operatorId}::bigint) as resultado`
    : await sql<{ resultado: { ok: boolean; error?: string } }>`
        select fn_reiniciar_ensayo(${operatorId}::bigint) as resultado`;
  return row.resultado.ok ? { ok: true, backup } : { ok: false, error: row.resultado.error ?? "RESET_FAILED" };
}
