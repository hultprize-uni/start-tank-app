// Aplica las migraciones de db/migrations/ cuyo nombre empieza con el prefijo indicado.
// Uso: pnpm db:apply 20261124
//
// Conecta por WebSocket (puerto 443) con el driver de Neon, igual que la aplicación, y usa
// DATABASE_URL de .env. Todos los archivos van en una sola transacción: si uno falla, no se aplica
// ninguno. No lleva registro de lo aplicado; hay que indicar el prefijo de las migraciones pendientes.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";

const prefix = process.argv[2];
if (!prefix) {
  console.error("Indica el prefijo de las migraciones pendientes. Ejemplo: pnpm db:apply 20261124");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definida en .env");
  process.exit(1);
}

const dir = join(process.cwd(), "db", "migrations");
const files = readdirSync(dir)
  .filter((file) => file.startsWith(prefix) && file.endsWith(".sql"))
  .sort();
if (files.length === 0) {
  console.error(`Ninguna migración empieza con ${prefix}`);
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  const { rows } = await client.query("select current_database() as db");
  console.log(`Servidor ${new URL(url).hostname}, base ${rows[0].db}. Migraciones: ${files.length}`);
  await client.query("begin");
  for (const file of files) {
    try {
      await client.query(readFileSync(join(dir, file), "utf8"));
      console.log(`  ok  ${file}`);
    } catch (error) {
      console.error(`  FALLÓ  ${file}: ${error.message}`);
      throw error;
    }
  }
  await client.query("commit");
  console.log("Listo: todas las migraciones quedaron aplicadas.");
} catch {
  await client.query("rollback").catch(() => undefined);
  console.error("Se revirtió todo: la base quedó como estaba.");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
