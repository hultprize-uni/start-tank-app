/**
 * Pruebas de integración de fn_revelar_veredicto v2: multiplicador continuo a partir del puntaje
 * promedio de los jurados, rescate con los presentes y permisos del rol.
 */
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  type Score,
  castVote,
  closeForVoting,
  createUser,
  getBalance,
  getJurorIds,
  getOperatorId,
  getPriceRow,
  getRoundMultiplier,
  getRoundState,
  getSecondsToPhaseEnd,
  getSupportOperatorId,
  invest,
  openRoundNumber,
  operatorAction,
  reveal,
  settleRound,
} from "./helpers/fixtures";

const db = registerTestDatabase();

async function countActions(pool: Pool, roundId: number, action: string): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    "select count(*)::int as total from accion_ronda where id_ronda = $1 and accion = $2",
    [roundId, action],
  );
  return rows[0].total;
}

describe("fn_revelar_veredicto: reveal gating", () => {
  it("blocks the reveal while any juror has not voted", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const jurors = await getJurorIds(db.pool);
    for (const juror of jurors.slice(0, 3)) {
      await castVote(db.pool, juror, roundId, 4);
    }

    expect(await reveal(db.pool, operatorId, roundId)).toEqual({ ok: false, error: "VOTOS_PENDIENTES" });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
    expect(await getRoundMultiplier(db.pool, roundId)).toBeNull();
    expect(await countActions(db.pool, roundId, "REVELAR")).toBe(0);
  });

  it("allows the reveal once every juror has submitted", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    expect(await settleRound(db.pool, operatorId, roundId, [4, 4, 4, 2])).toMatchObject({ ok: true });
    expect(await getRoundState(db.pool, roundId)).toBe("LIQUIDADA");
  });

  it("registers the reveal as an operator action with the operator identifier", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    await settleRound(db.pool, operatorId, roundId, [3, 3, 3, 3]);

    const { rows } = await db.pool.query<{ id_operador: string; accion: string }>(
      "select id_operador, accion from accion_ronda where id_ronda = $1 and accion = 'REVELAR'",
      [roundId],
    );
    expect(rows).toEqual([{ id_operador: String(operatorId), accion: "REVELAR" }]);
  });

  it("rejects the reveal while the round is closed and voting is not enabled", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await operatorAction(db.pool, operatorId, roundId, "CERRAR");

    expect(await reveal(db.pool, operatorId, roundId)).toEqual({
      ok: false,
      error: "RONDA_NO_EN_VOTACION",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("CERRADA");
  });

  it("rejects the reveal while the round is still open for purchases", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);

    expect(await reveal(db.pool, operatorId, roundId)).toMatchObject({
      ok: false,
      error: "RONDA_NO_EN_VOTACION",
    });
  });

  it("rejects an operator that does not exist", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    expect(await reveal(db.pool, 999999, roundId)).toEqual({ ok: false, error: "OPERADOR_NO_EXISTE" });
  });

  it("rejects a round that does not exist", async () => {
    const operatorId = await getOperatorId(db.pool);

    expect(await reveal(db.pool, operatorId, 999999)).toEqual({ ok: false, error: "RONDA_NO_EXISTE" });
  });

  it("rejects the reveal when the event has no jurors", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    await db.pool.query("delete from jurado");

    expect(await reveal(db.pool, operatorId, roundId)).toEqual({ ok: false, error: "SIN_JURADOS" });
  });

  it("rejects the reveal when every juror abstains", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    const result = await settleRound(db.pool, operatorId, roundId, [
      "ABSTIENE",
      "ABSTIENE",
      "ABSTIENE",
      "ABSTIENE",
    ]);

    expect(result).toEqual({ ok: false, error: "SIN_VOTOS_EMITIDOS" });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });

  it("does not let the support role reveal the verdict", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    for (const juror of await getJurorIds(db.pool)) {
      await castVote(db.pool, juror, roundId, 4);
    }

    expect(await reveal(db.pool, await getSupportOperatorId(db.pool), roundId)).toEqual({
      ok: false,
      error: "SIN_PERMISO",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });
});

describe("fn_revelar_veredicto: rescue with the jurors present", () => {
  async function roundWithThreeVotes(): Promise<{ operatorId: number; roundId: number }> {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const jurors = await getJurorIds(db.pool);
    for (const juror of jurors.slice(0, 3)) {
      await castVote(db.pool, juror, roundId, 4);
    }
    return { operatorId, roundId };
  }

  it("requires a reason", async () => {
    const { operatorId, roundId } = await roundWithThreeVotes();

    expect(await reveal(db.pool, operatorId, roundId, { withPresent: true })).toEqual({
      ok: false,
      error: "MOTIVO_REQUERIDO",
    });
    expect(await reveal(db.pool, operatorId, roundId, { withPresent: true, reason: "  " })).toEqual({
      ok: false,
      error: "MOTIVO_REQUERIDO",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });

  it("settles with the votes received and logs the reason", async () => {
    const { operatorId, roundId } = await roundWithThreeVotes();

    const result = await reveal(db.pool, operatorId, roundId, {
      withPresent: true,
      reason: "El jurado 4 perdió conexión",
    });

    expect(result).toMatchObject({ ok: true, multiplicador: 1.4, puntaje_jurado: 4 });
    const { rows } = await db.pool.query<{ accion: string; motivo: string }>(
      "select accion, motivo from accion_ronda where id_ronda = $1 and accion like 'REVELAR%'",
      [roundId],
    );
    expect(rows).toEqual([{ accion: "REVELAR_PRESENTES", motivo: "El jurado 4 perdió conexión" }]);
  });

  it("does not need a reason when every juror has already submitted", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    for (const juror of await getJurorIds(db.pool)) {
      await castVote(db.pool, juror, roundId, 3);
    }

    expect(await reveal(db.pool, operatorId, roundId, { withPresent: true })).toMatchObject({ ok: true });
    expect(await countActions(db.pool, roundId, "REVELAR")).toBe(1);
  });
});

describe("fn_revelar_veredicto: continuous multiplier", () => {
  it.each<[number, number]>([
    [1, 0.2],
    [2, 0.6],
    [3, 1],
    [4, 1.4],
    [5, 1.8],
  ])("maps a unanimous score of %i to a multiplier of %f", async (score, multiplier) => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    const result = await settleRound(db.pool, operatorId, roundId, [score, score, score, score]);

    expect(result).toMatchObject({ ok: true, multiplicador: multiplier, puntaje_jurado: score });
    expect(await getRoundMultiplier(db.pool, roundId)).toBe(multiplier);
  });

  it("averages the jurors' scores into a continuous multiplier", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    // Promedio 4.25: 0.2 + 1.6 x (3.25 / 4) = 1.5.
    const result = await settleRound(db.pool, operatorId, roundId, [5, 5, 4, 3]);

    expect(result).toMatchObject({ ok: true, multiplicador: 1.5, puntaje_jurado: 4.25 });
  });

  it("excludes abstentions from the average", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    // Promedio de 4, 4 y 2 = 3.3333; multiplicador 0.2 + 1.6 x (2.3333 / 4) = 1.133.
    const scores: Score[] = [4, 4, 2, "ABSTIENE"];
    const result = await settleRound(db.pool, operatorId, roundId, scores);

    expect(result).toMatchObject({ ok: true, multiplicador: 1.133, puntaje_jurado: 3.3333 });
  });

  it("stores the jury score on the startup row and leaves the final score for the batch close", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    await settleRound(db.pool, operatorId, roundId, [5, 5, 4, 3]);

    const price = await getPriceRow(db.pool, roundId);
    expect(price.puntajeJurado).toBe(4.25);
    expect(price.puntaje).toBeNull();
  });

  it("sets the settlement time and the end of the result phase", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    await settleRound(db.pool, operatorId, roundId, [4, 4, 4, 4]);

    const { rows } = await db.pool.query<{ liquidada_en: Date | null; pausa: number | null }>(
      "select liquidada_en, segundos_restantes_pausa as pausa from ronda where id_ronda = $1",
      [roundId],
    );
    expect(rows[0].liquidada_en).not.toBeNull();
    expect(rows[0].pausa).toBeNull();
    // Fase de resultado configurada en 90 segundos.
    const remaining = await getSecondsToPhaseEnd(db.pool, roundId);
    expect(remaining).toBeGreaterThan(85);
    expect(remaining).toBeLessThanOrEqual(90);
  });
});

describe("fn_revelar_veredicto: idempotency", () => {
  it("returns the current result and changes nothing when the round is revealed again", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool);
    await invest(db.pool, user, roundId, 1000);
    await closeForVoting(db.pool, operatorId, roundId);
    const first = await settleRound(db.pool, operatorId, roundId, [4, 4, 4, 4]);
    const balanceAfterFirst = await getBalance(db.pool, user);

    const second = await reveal(db.pool, operatorId, roundId);

    expect(first).toMatchObject({ ok: true, multiplicador: 1.4 });
    expect(second).toMatchObject({ ok: true, multiplicador: 1.4, idempotente: true });
    expect(await getBalance(db.pool, user)).toBe(balanceAfterFirst);
    expect(balanceAfterFirst).toBe(10400);
    expect(await countActions(db.pool, roundId, "REVELAR")).toBe(1);
  });
});
