import { sql } from "../db/client.ts";
import { backupToFile } from "./respaldo.ts";

/*
 * Reinicio del modo ensayo (RF-29). Primero el respaldo a archivo: si no se puede escribir, no se
 * borra nada. Después fn_reiniciar_ensayo, que se niega con el evento iniciado.
 */
export async function runRehearsalReset(
  operatorId: string,
): Promise<{ ok: true; backup: string } | { ok: false; error: string }> {
  let backup: string;
  try {
    backup = await backupToFile("respaldo-ensayo");
  } catch {
    return { ok: false, error: "BACKUP_FAILED" };
  }
  const [row] = await sql<{ resultado: { ok: boolean; error?: string } }>`
    select fn_reiniciar_ensayo(${operatorId}::bigint) as resultado`;
  return row.resultado.ok ? { ok: true, backup } : { ok: false, error: row.resultado.error ?? "RESET_FAILED" };
}
