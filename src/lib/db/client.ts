import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Cliente HTTP de Neon. Se crea en la primera consulta y no al importar el módulo, de modo que
 * la compilación de Next.js no falle cuando DATABASE_URL no está definida.
 */
let neonClient: NeonQueryFunction<false, false> | undefined;

function getNeonClient(): NeonQueryFunction<false, false> {
  if (neonClient === undefined) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("La variable de entorno DATABASE_URL no está definida.");
    }
    neonClient = neon(url);
  }
  return neonClient;
}

/**
 * Ejecuta una consulta parametrizada con plantilla etiquetada. Los valores interpolados se envían
 * como parámetros, de modo que no se concatenan en el texto SQL.
 *
 * Los tipos numeric y bigint de Postgres llegan como cadenas; los llamadores deben convertirlos.
 */
export async function sql<T extends object>(
  strings: TemplateStringsArray,
  ...params: unknown[]
): Promise<T[]> {
  const rows = await getNeonClient()(strings, ...params);
  return rows as T[];
}
