/**
 * Pruebas de integración de los procesos batch (WORKPLAN F7): carga de resultados del cierre,
 * reinicio del ensayo, respaldo con restauración y reconstrucción del leaderboard.
 */
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  closeForVoting,
  createUser,
  getBalance,
  getLeaderboard,
  getOperatorId,
  getRoundId,
  getSupportOperatorId,
  invest,
  openRound,
  settleRound,
} from "./helpers/fixtures";

const db = registerTestDatabase();

type FnResult = { ok: boolean; error?: string };

async function call(pool: Pool, query: string, params: unknown[] = []): Promise<FnResult> {
  const { rows } = await pool.query<{ r: FnResult }>(`select ${query} as r`, params);
  return rows[0].r;
}

/** Juega la ronda indicada: abre, invierte cada compra, cierra, vota y revela. */
async function playRound(pool: Pool, number: number, purchases: [number, number][], score: number) {
  const operatorId = await getOperatorId(pool);
  const roundId = await getRoundId(pool, number);
  await openRound(pool, operatorId, roundId);
  for (const [user, amount] of purchases) {
    expect(await invest(pool, user, roundId, amount)).toMatchObject({ ok: true });
  }
  await closeForVoting(pool, operatorId, roundId);
  expect(await settleRound(pool, operatorId, roundId, [score, score, score, score])).toMatchObject({ ok: true });
  return roundId;
}

describe("fn_cargar_resultados", () => {
  it("rejects the close while a round is pending", async () => {
    const operatorId = await getOperatorId(db.pool);
    expect(await call(db.pool, "fn_cargar_resultados($1, '[]'::jsonb)", [operatorId])).toEqual({
      ok: false,
      error: "RONDAS_PENDIENTES",
    });
  });

  it("loads the final score of every startup and logs the close", async () => {
    const user = await createUser(db.pool);
    for (let n = 1; n <= 5; n += 1) await playRound(db.pool, n, [[user, 500]], 4);
    const operatorId = await getOperatorId(db.pool);
    const payload = JSON.stringify([{ id_ronda: String(await getRoundId(db.pool, 2)), puntaje: 0.81234 }]);

    expect(await call(db.pool, "fn_cargar_resultados($1, $2::jsonb)", [operatorId, payload])).toEqual({ ok: true });

    const { rows } = await db.pool.query<{ puntaje: string }>(
      "select puntaje::text from startup_leaderboard where id_ronda = $1",
      [await getRoundId(db.pool, 2)],
    );
    expect(rows[0].puntaje).toBe("0.8123");
    const log = await db.pool.query("select 1 from accion_ronda where accion = 'CERRAR_EVENTO'");
    expect(log.rowCount).toBe(1);
  });

  it("is reserved for the conductor", async () => {
    const support = await getSupportOperatorId(db.pool);
    expect(await call(db.pool, "fn_cargar_resultados($1, '[]'::jsonb)", [support])).toEqual({
      ok: false,
      error: "SIN_PERMISO",
    });
  });
});

describe("fn_reiniciar_ensayo", () => {
  it("clears the rehearsal and returns every balance to the initial capital", async () => {
    const user = await createUser(db.pool);
    const roundId = await playRound(db.pool, 1, [[user, 1_000]], 5);
    expect(await getBalance(db.pool, user)).toBe(10_800);

    expect(await call(db.pool, "fn_reiniciar_ensayo($1)", [await getOperatorId(db.pool)])).toEqual({ ok: true });

    expect(await getBalance(db.pool, user)).toBe(10_000);
    const counts = await db.pool.query<{ inv: number; ver: number; lb: number }>(
      `select (select count(*)::int from inversion) as inv,
              (select count(*)::int from veredicto) as ver,
              (select count(*)::int from leaderboard) as lb`,
    );
    expect(counts.rows[0]).toEqual({ inv: 0, ver: 0, lb: 0 });
    const round = await db.pool.query<{ estado: string; multiplicador: string | null }>(
      "select estado, multiplicador from ronda where id_ronda = $1",
      [roundId],
    );
    expect(round.rows[0]).toEqual({ estado: "PROGRAMADA", multiplicador: null });
  });

  it("is blocked once the event started", async () => {
    await db.pool.query("update configuracion set valor = 'true' where clave = 'evento_iniciado'");
    expect(await call(db.pool, "fn_reiniciar_ensayo($1)", [await getOperatorId(db.pool)])).toEqual({
      ok: false,
      error: "EVENTO_INICIADO",
    });
  });
});

describe("fn_respaldo and fn_restaurar", () => {
  it("restores the exact state and keeps new identifiers after the restored ones", async () => {
    const user = await createUser(db.pool);
    await playRound(db.pool, 1, [[user, 1_000]], 4);
    const { rows } = await db.pool.query<{ datos: object }>("select fn_respaldo() as datos");
    const snapshot = rows[0].datos;

    await playRound(db.pool, 2, [[user, 500]], 1);
    expect(await getBalance(db.pool, user)).toBe(10_000);

    expect(await call(db.pool, "fn_restaurar($1::jsonb)", [JSON.stringify(snapshot)])).toEqual({ ok: true });

    expect(await getBalance(db.pool, user)).toBe(10_400);
    const again = await db.pool.query<{ datos: object }>("select fn_respaldo() as datos");
    expect(again.rows[0].datos).toEqual(snapshot);

    const next = await createUser(db.pool);
    expect(next).toBeGreaterThan(user);
  });
});

describe("fn_reconstruir_leaderboard", () => {
  it("rebuilds both leaderboards from the movements", async () => {
    const first = await createUser(db.pool);
    const second = await createUser(db.pool);
    const r1 = await playRound(db.pool, 1, [[first, 2_000], [second, 1_000]], 4);
    const r2 = await playRound(db.pool, 2, [[first, 500]], 2);
    const before = [await getLeaderboard(db.pool, r1), await getLeaderboard(db.pool, r2)];
    const prices = await db.pool.query("select * from startup_leaderboard order by id_ronda");

    await db.pool.query("delete from leaderboard");
    await db.pool.query("update startup_leaderboard set monto_acumulado = 0, inversores_unicos = 0, puntaje_jurado = null");

    expect(await call(db.pool, "fn_reconstruir_leaderboard()")).toMatchObject({ ok: true });

    expect([await getLeaderboard(db.pool, r1), await getLeaderboard(db.pool, r2)]).toEqual(before);
    const rebuilt = await db.pool.query("select * from startup_leaderboard order by id_ronda");
    expect(rebuilt.rows).toEqual(prices.rows);
  });
});
