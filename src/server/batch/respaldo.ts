import { sql } from "../db/client.ts";
import { latestOutput, readOutput, writeOutput } from "./io.ts";

/* Backup y Restore (RNF-08): UNLOAD de todas las tablas a un archivo y RESTORE del último. */

export type Snapshot = Record<string, unknown[]>;

/** UNLOAD de todas las tablas, en memoria. */
export async function takeSnapshot(): Promise<Snapshot> {
  const [row] = await sql<{ datos: Snapshot }>`select fn_respaldo() as datos`;
  return row.datos;
}

/** RESTORE de un respaldo en una transacción. */
export async function restoreSnapshot(snapshot: Snapshot): Promise<void> {
  await sql`select fn_restaurar(${JSON.stringify(snapshot)}::jsonb)`;
}

/** Respaldo a archivo. Devuelve la ruta. */
export async function backupToFile(label = "respaldo"): Promise<string> {
  return writeOutput(label, "json", JSON.stringify(await takeSnapshot()));
}

/** Restaura el archivo indicado o, si no se indica, el último respaldo. */
export async function restoreFromFile(path?: string): Promise<string> {
  const file = path ?? (await latestOutput("respaldo"));
  if (file === null) throw new Error("No hay respaldos en batch-out/.");
  await restoreSnapshot(JSON.parse(await readOutput(file)) as Snapshot);
  return file;
}
