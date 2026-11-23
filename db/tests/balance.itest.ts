/**
 * Pruebas de integración de fn_ajustar_saldo (corrección manual del saldo por el conductor) y de
 * los latidos de conexión.
 */
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  adjustBalance,
  createUser,
  getBalance,
  getJurorIds,
  getOperatorId,
  getRoundId,
  getSupportOperatorId,
  openRoundNumber,
} from "./helpers/fixtures";

const db = registerTestDatabase();

describe("fn_ajustar_saldo", () => {
  it("adds to the balance and logs the adjustment against the active round", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool);

    expect(await adjustBalance(db.pool, operatorId, user, 500, "Compra duplicada por error")).toEqual({
      ok: true,
      saldo: 10500,
    });

    expect(await getBalance(db.pool, user)).toBe(10500);
    const { rows } = await db.pool.query<{ id_ronda: string; motivo: string }>(
      "select id_ronda, motivo from accion_ronda where accion = 'AJUSTE_SALDO'",
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].id_ronda)).toBe(roundId);
    expect(rows[0].motivo).toContain(`usuario ${user}`);
    expect(rows[0].motivo).toContain("Compra duplicada por error");
  });

  it("subtracts with a negative amount", async () => {
    const operatorId = await getOperatorId(db.pool);
    const user = await createUser(db.pool);

    expect(await adjustBalance(db.pool, operatorId, user, -2500)).toEqual({ ok: true, saldo: 7500 });
  });

  it("logs against the first round when no round has started", async () => {
    const operatorId = await getOperatorId(db.pool);
    const user = await createUser(db.pool);

    await adjustBalance(db.pool, operatorId, user, 100);

    const { rows } = await db.pool.query<{ id_ronda: string }>(
      "select id_ronda from accion_ronda where accion = 'AJUSTE_SALDO'",
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].id_ronda)).toBe(await getRoundId(db.pool, 1));
  });

  it("never leaves the balance negative", async () => {
    const operatorId = await getOperatorId(db.pool);
    const user = await createUser(db.pool, { balance: 300 });

    expect(await adjustBalance(db.pool, operatorId, user, -300.01)).toEqual({
      ok: false,
      error: "SALDO_NEGATIVO",
      saldo: 300,
    });
    expect(await getBalance(db.pool, user)).toBe(300);
    expect(await adjustBalance(db.pool, operatorId, user, -300)).toMatchObject({ ok: true, saldo: 0 });
  });

  it("requires a reason and a non-zero amount", async () => {
    const operatorId = await getOperatorId(db.pool);
    const user = await createUser(db.pool);

    expect(await adjustBalance(db.pool, operatorId, user, 100, null)).toEqual({
      ok: false,
      error: "MOTIVO_REQUERIDO",
    });
    expect(await adjustBalance(db.pool, operatorId, user, 100, "  ")).toEqual({
      ok: false,
      error: "MOTIVO_REQUERIDO",
    });
    expect(await adjustBalance(db.pool, operatorId, user, 0)).toEqual({
      ok: false,
      error: "MONTO_INVALIDO",
    });
    expect(await getBalance(db.pool, user)).toBe(10000);
  });

  it("is reserved for the conductor role", async () => {
    const user = await createUser(db.pool);

    expect(await adjustBalance(db.pool, await getSupportOperatorId(db.pool), user, 100)).toEqual({
      ok: false,
      error: "SIN_PERMISO",
    });
    expect(await getBalance(db.pool, user)).toBe(10000);
  });

  it("rejects an operator or a user that does not exist", async () => {
    const operatorId = await getOperatorId(db.pool);
    const user = await createUser(db.pool);

    expect(await adjustBalance(db.pool, 999999, user, 100)).toEqual({
      ok: false,
      error: "OPERADOR_NO_EXISTE",
    });
    expect(await adjustBalance(db.pool, operatorId, 999999, 100)).toEqual({
      ok: false,
      error: "USUARIO_NO_EXISTE",
    });
  });
});

describe("connection heartbeats", () => {
  it("records the last connection of an attendee at most once every 15 seconds", async () => {
    const user = await createUser(db.pool);

    await db.pool.query("select fn_latido_usuario($1)", [user]);
    const first = await db.pool.query<{ ultima_conexion: Date | null }>(
      "select ultima_conexion from usuario where id_usuario = $1",
      [user],
    );
    expect(first.rows[0].ultima_conexion).not.toBeNull();

    await db.pool.query("select fn_latido_usuario($1)", [user]);
    const second = await db.pool.query<{ ultima_conexion: Date | null }>(
      "select ultima_conexion from usuario where id_usuario = $1",
      [user],
    );
    expect(second.rows[0].ultima_conexion).toEqual(first.rows[0].ultima_conexion);

    await db.pool.query(
      "update usuario set ultima_conexion = now() - interval '1 minute' where id_usuario = $1",
      [user],
    );
    await db.pool.query("select fn_latido_usuario($1)", [user]);
    const third = await db.pool.query<{ reciente: boolean }>(
      "select ultima_conexion > now() - interval '5 seconds' as reciente from usuario where id_usuario = $1",
      [user],
    );
    expect(third.rows[0].reciente).toBe(true);
  });

  it("records the last connection of a juror", async () => {
    const [juror] = await getJurorIds(db.pool);

    await db.pool.query("select fn_latido_jurado($1)", [juror]);

    const { rows } = await db.pool.query<{ ultima_conexion: Date | null }>(
      "select ultima_conexion from jurado where id_jurado = $1",
      [juror],
    );
    expect(rows[0].ultima_conexion).not.toBeNull();
  });
});
