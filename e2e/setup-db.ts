/*
 * Base de datos del entorno de pruebas end-to-end. Este módulo se importa desde las pruebas y
 * desde la línea de comandos. Desde la raíz del repositorio, `pnpm e2e:db` recrea el esquema
 * público, aplica db/migrations/*.sql en orden y carga db/seed.sql.
 *
 * La operación de recreación elimina el esquema público de la base indicada, por lo que solo se
 * admiten hosts locales. Las rutas se resuelven desde el directorio de trabajo, que es la raíz.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/** Puerto del Postgres local del entorno de pruebas (ver e2e/docker-compose.yml). */
const DB_PORT = process.env.E2E_DB_PORT ?? "55433";

/** Conexión directa a Postgres, usada por las pruebas para restablecer las tablas. */
export const DIRECT_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? `postgres://postgres:postgres@localhost:${DB_PORT}/startank`;

/** Tablas de negocio que se vacían antes de cada prueba. El esquema y las migraciones se conservan. */
const BUSINESS_TABLES = [
  "accion_ronda",
  "leaderboard",
  "inversion",
  "veredicto",
  "startup_leaderboard",
  "ronda",
  "startup",
  "jurado",
  "operador",
  "usuario",
];

const HOSTS_ALLOWED_FOR_RECREATE = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Verifica que la conexión apunte a un host local antes de eliminar el esquema. */
function assertLocalDatabase(connectionString: string): void {
  const hostname = new URL(connectionString).hostname;
  if (!HOSTS_ALLOWED_FOR_RECREATE.has(hostname)) {
    throw new Error(
      `La base ${hostname} no es local. Las pruebas solo recrean bases en localhost.`,
    );
  }
}

/** Abre una conexión directa, ejecuta la tarea y la cierra aunque falle. */
async function withClient<T>(
  connectionString: string,
  task: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await task(client);
  } finally {
    await client.end();
  }
}

/** Lista los archivos de migración en orden lexicográfico, que coincide con el orden de aplicación. */
function migrationFiles(): string[] {
  return readdirSync(join(process.cwd(), "db", "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => join(process.cwd(), "db", "migrations", name));
}

/** Lee el seed de desarrollo, que contiene jurados, operador y startups de ejemplo. */
function seedSql(): string {
  return readFileSync(join(process.cwd(), "db", "seed.sql"), "utf8");
}

/**
 * Recrea el esquema público con las migraciones y el seed. Puede ejecutarse varias veces: cada
 * ejecución parte de un esquema vacío.
 */
export async function setupDatabase(connectionString: string = DIRECT_DATABASE_URL): Promise<void> {
  assertLocalDatabase(connectionString);
  await withClient(connectionString, async (client) => {
    await client.query("drop schema if exists public cascade; create schema public;");
    for (const file of migrationFiles()) {
      await client.query(readFileSync(file, "utf8"));
    }
    await client.query(seedSql());
  });
}

/**
 * Vacía las tablas de negocio, reinicia sus identidades y vuelve a cargar el seed. Las pruebas
 * llaman a esta función antes de cada caso para que no compartan estado.
 */
export async function resetDatabase(connectionString: string = DIRECT_DATABASE_URL): Promise<void> {
  assertLocalDatabase(connectionString);
  await withClient(connectionString, async (client) => {
    await client.query(
      `truncate table ${BUSINESS_TABLES.join(", ")} restart identity cascade; ${seedSql()}`,
    );
  });
}

/** Punto de entrada de la línea de comandos: aplica migraciones y seed sobre la base local. */
function runFromCommandLine(): void {
  setupDatabase()
    .then(() => {
      console.log("Base de datos del entorno de pruebas lista.");
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

if (process.argv[1]?.endsWith("setup-db.ts")) {
  runFromCommandLine();
}
