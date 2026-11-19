import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Pruebas de la rama del proxy HTTP local de Neon. El driver se reemplaza por un doble para
 * inspeccionar la configuración global que el cliente aplica antes de la primera consulta.
 */

const driver = vi.hoisted(() => {
  const DEFAULTS = {
    fetchEndpoint: "https://neon.example.test/sql",
    useSecureWebSocket: true,
    poolQueryViaFetch: false,
  };
  return {
    DEFAULTS,
    neonConfig: { ...DEFAULTS },
    neon: vi.fn(),
  };
});

vi.mock("@neondatabase/serverless", () => ({
  neon: driver.neon,
  neonConfig: driver.neonConfig,
}));

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
const ORIGINAL_PROXY_URL = process.env.NEON_LOCAL_PROXY_URL;

/** Carga un cliente nuevo, sin el cliente cacheado de pruebas anteriores, y ejecuta una consulta. */
async function runQuery(): Promise<void> {
  vi.resetModules();
  const { sql } = await import("./client");
  driver.neon.mockReturnValue(vi.fn().mockResolvedValue([{ valor: 1 }]));
  await sql<{ valor: number }>`select 1 as valor`;
}

describe("sql con el proxy local de Neon", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@db.localtest.me:5432/startank";
    Object.assign(driver.neonConfig, driver.DEFAULTS);
    driver.neon.mockReset();
  });

  afterEach(() => {
    restoreVariable("DATABASE_URL", ORIGINAL_DATABASE_URL);
    restoreVariable("NEON_LOCAL_PROXY_URL", ORIGINAL_PROXY_URL);
  });

  it("conserva la configuración del driver cuando NEON_LOCAL_PROXY_URL no está definida", async () => {
    delete process.env.NEON_LOCAL_PROXY_URL;

    await runQuery();

    expect(driver.neonConfig).toEqual(driver.DEFAULTS);
    expect(driver.neon).toHaveBeenCalledWith(process.env.DATABASE_URL);
  });

  it("dirige el driver al endpoint /sql del proxy cuando NEON_LOCAL_PROXY_URL está definida", async () => {
    process.env.NEON_LOCAL_PROXY_URL = "http://localhost:55434";

    await runQuery();

    expect(driver.neonConfig.fetchEndpoint).toBe("http://localhost:55434/sql");
    expect(driver.neonConfig.useSecureWebSocket).toBe(false);
    expect(driver.neonConfig.poolQueryViaFetch).toBe(true);
  });

  it("elimina las barras finales de NEON_LOCAL_PROXY_URL antes de formar el endpoint", async () => {
    process.env.NEON_LOCAL_PROXY_URL = "http://localhost:55434//";

    await runQuery();

    expect(driver.neonConfig.fetchEndpoint).toBe("http://localhost:55434/sql");
  });
});

/** Restaura una variable de entorno a su valor original, o la elimina si no existía. */
function restoreVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
