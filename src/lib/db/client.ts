import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Cliente HTTP de Neon. Se crea en la primera consulta y no al importar el módulo, de modo que
 * la compilación de Next.js no falle cuando DATABASE_URL no está definida.
 */
let clienteNeon: NeonQueryFunction<false, false> | undefined;

function obtenerClienteNeon(): NeonQueryFunction<false, false> {
  if (clienteNeon === undefined) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("La variable de entorno DATABASE_URL no está definida.");
    }
    clienteNeon = neon(url);
  }
  return clienteNeon;
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
  const filas = await obtenerClienteNeon()(strings, ...params);
  return filas as T[];
}
