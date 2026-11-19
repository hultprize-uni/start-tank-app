import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Cliente HTTP de Neon. Se crea en la primera consulta y no al importar el módulo, de modo que
 * la compilación de Next.js no falle cuando DATABASE_URL no está definida.
 */
let neonClient: NeonQueryFunction<false, false> | undefined;

/**
 * Dirige el driver al proxy HTTP local de Neon cuando NEON_LOCAL_PROXY_URL está definida. El proxy
 * traduce las consultas HTTP en conexiones a un Postgres local (ver docs/testing.md). Sin la
 * variable, el driver conserva su configuración habitual y el comportamiento de producción no cambia.
 */
function applyLocalProxyConfig(): void {
  const proxyUrl = process.env.NEON_LOCAL_PROXY_URL;
  if (!proxyUrl) {
    return;
  }
  neonConfig.fetchEndpoint = `${proxyUrl.replace(/\/+$/, "")}/sql`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
}

function getNeonClient(): NeonQueryFunction<false, false> {
  if (neonClient === undefined) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("La variable de entorno DATABASE_URL no está definida.");
    }
    applyLocalProxyConfig();
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
