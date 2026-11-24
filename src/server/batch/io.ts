import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * Archivos de salida de los procesos batch. Van a batch-out/ (ignorada por git) o a BATCH_OUT_DIR;
 * en un despliegue sin disco escribible se apunta a /tmp.
 */

let privateTmp: Promise<string> | null = null;

async function outDir(): Promise<string> {
  if (process.env.BATCH_OUT_DIR) return process.env.BATCH_OUT_DIR;
  if (!process.env.VERCEL) return join(process.cwd(), "batch-out");
  // En Vercel solo /tmp es escribible, y es compartido: una carpeta propia con nombre aleatorio
  // evita que otro proceso adivine la ruta del respaldo. shortcut: dura lo que la instancia; para
  // conservar respaldos del evento, correr `pnpm batch respaldo` desde una PC.
  privateTmp ??= mkdtemp(join(tmpdir(), "batch-out-"));
  return privateTmp;
}

/**
 * Marca de tiempo ordenable para el nombre del archivo, por ejemplo 2026-11-26T20-15-03.123. Lleva
 * milisegundos para que dos salidas del mismo segundo no choquen con "wx".
 */
function stamp(date: Date): string {
  return date.toISOString().slice(0, 23).replace(/:/g, "-");
}

/** Escribe un archivo de salida y devuelve su ruta. */
export async function writeOutput(name: string, ext: "json" | "csv", content: string): Promise<string> {
  const dir = await outDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, `${stamp(new Date())}-${name}.${ext}`);
  // Solo el dueño lee el respaldo (tiene los saldos), y "wx" falla en vez de pisar un archivo o
  // enlace que ya exista con ese nombre.
  await writeFile(path, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return path;
}

/** Último archivo de salida cuyo nombre contiene el fragmento indicado, o null. */
export async function latestOutput(fragment: string): Promise<string | null> {
  try {
    const dir = await outDir();
    const files = (await readdir(dir)).filter((file) => file.includes(fragment)).sort();
    return files.length === 0 ? null : join(dir, files[files.length - 1]);
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
