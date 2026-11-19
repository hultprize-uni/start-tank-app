/**
 * Helper de pruebas de integración para la capa SQL de Start Tank.
 *
 * Cada archivo de prueba construye una plantilla de base de datos con las migraciones de
 * `db/migrations/` (en orden lexicográfico) y con `db/seed.sql`. Antes de cada prueba, la
 * plantilla se clona en una base de datos nueva; de este modo, cada prueba parte de un estado
 * limpio y no comparte filas con las demás. Al terminar cada prueba se elimina su base de datos,
 * y al terminar el archivo se elimina la plantilla.
 *
 * Requisito: la variable `TEST_DATABASE_URL` apunta a un servidor Postgres de desarrollo o de
 * prueba. El helper no utiliza `DATABASE_URL` y rechaza hosts de Neon.
 */
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

/** Directorio `db/`, raíz de las migraciones y del archivo de datos de ejemplo. */
const DB_ROOT = new URL("../../", import.meta.url);
const MIGRATIONS_DIR = fileURLToPath(new URL("migrations/", DB_ROOT));
const SEED_FILE = fileURLToPath(new URL("seed.sql", DB_ROOT));

/** Tiempo máximo para construir la plantilla o limpiar recursos en un hook. */
const HOOK_TIMEOUT_MS = 30_000;

export interface TestDatabase {
  /** Pool conectado a la base de datos aislada de la prueba en curso. */
  readonly pool: Pool;
  /** Nombre de la base de datos aislada de la prueba en curso. */
  readonly name: string;
}

function resolveAdminUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw) {
    throw new Error(
      "La variable TEST_DATABASE_URL no está definida. Consultar la sección de pruebas de integración en db/README.md.",
    );
  }
  const url = new URL(raw);
  if (url.hostname.endsWith(".neon.tech")) {
    throw new Error(
      "TEST_DATABASE_URL apunta a un host de Neon. Las pruebas de integración solo operan contra servidores de desarrollo o de prueba.",
    );
  }
  return url.toString();
}

function buildDatabaseUrl(adminUrl: string, database: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function randomName(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

async function readMigrationScripts(): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const scripts: string[] = [];
  for (const file of files) {
    scripts.push(await readFile(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return scripts;
}

/**
 * Crea la plantilla y aplica, en una sola transacción, las migraciones y el archivo de datos de
 * ejemplo. La conexión a la plantilla se cierra antes de que se clonen las bases de las pruebas.
 */
async function buildTemplate(admin: Pool, adminUrl: string, template: string): Promise<void> {
  await admin.query(`CREATE DATABASE "${template}"`);

  const pool = new Pool({ connectionString: buildDatabaseUrl(adminUrl, template), max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const script of await readMigrationScripts()) {
      await client.query(script);
    }
    await client.query(await readFile(SEED_FILE, "utf8"));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function dropDatabase(admin: Pool, name: string): Promise<void> {
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
}

/**
 * Registra los hooks de ciclo de vida del archivo de prueba y devuelve un manejador de la base de
 * datos de la prueba en curso.
 *
 * Uso:
 * ```ts
 * const db = registerTestDatabase();
 * it("registers an investment", async () => {
 *   await db.pool.query("select 1");
 * });
 * ```
 */
export function registerTestDatabase(): TestDatabase {
  let admin: Pool | undefined;
  let adminUrl = "";
  let template: string | undefined;
  let current: TestDatabase | undefined;

  beforeAll(async () => {
    adminUrl = resolveAdminUrl();
    admin = new Pool({ connectionString: adminUrl, max: 2 });
    template = randomName("st_tpl");
    await buildTemplate(admin, adminUrl, template);
  }, HOOK_TIMEOUT_MS);

  beforeEach(async () => {
    if (!admin || !template) {
      throw new Error("La plantilla de pruebas no está disponible.");
    }
    const name = randomName("st_test");
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${template}"`);
    current = {
      name,
      pool: new Pool({ connectionString: buildDatabaseUrl(adminUrl, name), max: 10 }),
    };
  }, HOOK_TIMEOUT_MS);

  afterEach(async () => {
    if (!admin || !current) {
      return;
    }
    const { name, pool } = current;
    current = undefined;
    await pool.end();
    await dropDatabase(admin, name);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    if (admin && template) {
      await dropDatabase(admin, template);
    }
    await admin?.end();
    admin = undefined;
    template = undefined;
  }, HOOK_TIMEOUT_MS);

  return {
    get pool(): Pool {
      if (!current) {
        throw new Error("No hay una base de datos de prueba activa fuera de un hook o prueba.");
      }
      return current.pool;
    },
    get name(): string {
      if (!current) {
        throw new Error("No hay una base de datos de prueba activa fuera de un hook o prueba.");
      }
      return current.name;
    },
  };
}
