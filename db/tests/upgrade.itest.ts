/**
 * Prueba de actualización: aplica las migraciones 20261124 sobre una base con datos del esquema
 * anterior, incluidas compras repetidas del mismo asistente en una ronda, tal como existen en
 * Neon. Las demás pruebas parten de una base vacía y no detectan problemas con datos existentes.
 */
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { expect, it } from "vitest";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));
const FIRST_NEW_MIGRATION = "20261124";

it("upgrades a database with legacy data, merging repeated purchases", async () => {
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw || new URL(raw).hostname.endsWith(".neon.tech")) {
    throw new Error("TEST_DATABASE_URL debe apuntar a un servidor local de pruebas.");
  }
  const name = `st_upgrade_${randomBytes(6).toString("hex")}`;
  const admin = new Pool({ connectionString: raw, max: 1 });
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(raw);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 1 });

  try {
    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
    const read = (file: string) => readFile(join(MIGRATIONS_DIR, file), "utf8");
    for (const file of files.filter((f) => f < FIRST_NEW_MIGRATION)) {
      await pool.query(await read(file));
    }

    // Datos del esquema anterior.
    await pool.query(`
      insert into startup (nombre, ods, orden_presentacion, descripcion) values ('S1', 'ODS 1', 1, 'd');
      insert into ronda (id_startup, numero, estado, multiplicador) values (1, 1, 'LIQUIDADA', 1.4);
      insert into usuario (proveedor_oauth, id_externo, correo, nombre, rubro) values
        ('test', 'a', 'a@example.test', 'A', 'rubro'), ('test', 'b', 'b@example.test', 'B', null);
      insert into jurado (codigo_acceso, nombre) values ('J1', 'J1'), ('J2', 'J2');
      insert into operador (codigo_acceso, nombre) values ('O1', 'O1');
      insert into inversion (id_usuario, id_ronda, monto, precio_momento, retorno, estado) values
        (1, 1, 1000, 100, 1400, 'LIQUIDADA'),
        (1, 1, 3000, 110, 4200, 'LIQUIDADA'),
        (2, 1, 500, 110, null, 'REGISTRADA');
      insert into veredicto (id_jurado, id_ronda, decision) values
        (1, 1, 'RESPALDA'), (2, 1, 'SE_ABSTIENE');
      insert into accion_ronda (id_operador, id_ronda, accion) values (1, 1, 'ABRIR');
      insert into startup_leaderboard (id_ronda, id_startup, fraccion_respaldo) values (1, 1, 1);
      insert into leaderboard (id_ronda, id_usuario, posicion, saldo) values (1, 1, 1, 10000);
    `);

    // Se aplican juntas, en una sola transacción, como lo hace `pnpm db:apply`.
    await pool.query("begin");
    for (const file of files.filter((f) => f >= FIRST_NEW_MIGRATION)) {
      await pool.query(await read(file));
    }
    await pool.query("commit");

    // Repetir las migraciones (por ejemplo, tras una ejecución anterior que quedó a medias) no falla.
    await pool.query("begin");
    for (const file of files.filter((f) => f >= FIRST_NEW_MIGRATION)) {
      await pool.query(await read(file));
    }
    await pool.query("commit");

    const merged = await pool.query(
      "select id_usuario, monto, precio_momento, retorno from inversion order by id_usuario",
    );
    expect(merged.rows.map((r) => [Number(r.id_usuario), Number(r.monto), Number(r.precio_momento)])).toEqual([
      [1, 4000, 107.5],
      [2, 500, 110],
    ]);
    expect(merged.rows.map((r) => (r.retorno === null ? null : Number(r.retorno)))).toEqual([5600, null]);

    const verdicts = await pool.query("select se_abstiene from veredicto order by id_jurado");
    expect(verdicts.rows.map((r) => r.se_abstiene)).toEqual([false, true]);

    const base = await pool.query(
      "select (select count(*)::int from criterio) as criterios, (select count(*)::int from configuracion) as claves",
    );
    expect(base.rows[0]).toEqual({ criterios: 4, claves: 13 });
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
