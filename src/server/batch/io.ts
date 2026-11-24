import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * Archivos de salida de los procesos batch. Van a batch-out/ (ignorada por git) o a BATCH_OUT_DIR;
 * en un despliegue sin disco escribible se apunta a /tmp.
 */

export function outDir(): string {
  // En Vercel solo /tmp es escribible. shortcut: ahí el archivo dura lo que la instancia; para
  // conservar respaldos del evento, correr `pnpm batch respaldo` desde una PC.
  const fallback = process.env.VERCEL ? join(tmpdir(), "batch-out") : join(process.cwd(), "batch-out");
  return process.env.BATCH_OUT_DIR ?? fallback;
}

/** Marca de tiempo ordenable para el nombre del archivo, por ejemplo 2026-11-26T20-15-03. */
function stamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace(/:/g, "-");
}

/** Escribe un archivo de salida y devuelve su ruta. */
export async function writeOutput(name: string, ext: "json" | "csv", content: string): Promise<string> {
  const dir = outDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${stamp(new Date())}-${name}.${ext}`);
  await writeFile(path, content, "utf8");
  return path;
}

/** Último archivo de salida cuyo nombre contiene el fragmento indicado, o null. */
export async function latestOutput(fragment: string): Promise<string | null> {
  try {
    const files = (await readdir(outDir())).filter((file) => file.includes(fragment)).sort();
    return files.length === 0 ? null : join(outDir(), files[files.length - 1]);
  } catch {
    return null;
  }
}

export async function readOutput(path: string): Promise<string> {
  return readFile(path, "utf8");
}

/** CSV con encabezado. Los valores con coma, comillas o salto de línea van entre comillas. */
export function toCsv(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => cell(row[h])).join(","))].join("\n") + "\n";
}
