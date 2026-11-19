/**
 * Pruebas de integración de fn_registrar_voto (especificación, sección 2.4).
 */
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  castVote,
  closeForVoting,
  getJurorIds,
  getOperatorId,
  getRoundId,
  getRoundState,
  openRound,
  openRoundNumber,
  operatorAction,
  settleRound,
} from "./helpers/fixtures";

const db = registerTestDatabase();

async function countVerdicts(pool: Pool, roundId: number): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    "select count(*)::int as total from veredicto where id_ronda = $1",
    [roundId],
  );
  return rows[0].total;
}

describe("fn_registrar_voto: voting window", () => {
  it("accepts a vote while the round is in voting", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const [juror] = await getJurorIds(db.pool);

    expect(await castVote(db.pool, juror, roundId, "RESPALDA")).toEqual({ ok: true });
    expect(await countVerdicts(db.pool, roundId)).toBe(1);
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });

  it.each([
    ["PROGRAMADA", "not opened"],
    ["ABIERTA", "open for purchases"],
    ["ULTIMA_LLAMADA", "in its last call"],
  ])("rejects votes while the round is %s (%s)", async (state) => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);
    if (state === "ABIERTA" || state === "ULTIMA_LLAMADA") {
      await openRound(db.pool, operatorId, roundId);
    }
    if (state === "ULTIMA_LLAMADA") {
      await operatorAction(db.pool, operatorId, roundId, "ULTIMA_LLAMADA");
    }
    const [juror] = await getJurorIds(db.pool);

    expect(await castVote(db.pool, juror, roundId, "RESPALDA")).toEqual({
      ok: false,
      error: "RONDA_NO_EN_VOTACION",
    });
    expect(await countVerdicts(db.pool, roundId)).toBe(0);
    expect(await getRoundState(db.pool, roundId)).toBe(state);
  });

  it("rejects votes while the market is closed but voting is not yet enabled", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    expect(await operatorAction(db.pool, operatorId, roundId, "CERRAR")).toMatchObject({ ok: true });
    const [juror] = await getJurorIds(db.pool);

    expect(await castVote(db.pool, juror, roundId, "RECHAZA")).toMatchObject({
      ok: false,
      error: "RONDA_NO_EN_VOTACION",
    });
    expect(await countVerdicts(db.pool, roundId)).toBe(0);
  });

  it("rejects votes once the verdict has been revealed", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    const jurors = await getJurorIds(db.pool);
    await closeForVoting(db.pool, operatorId, roundId);
    await settleRound(db.pool, operatorId, roundId, ["RESPALDA", "RESPALDA", "RESPALDA", "RESPALDA"]);

    // La ronda ya está liquidada. El jurado 1 ya votó, por lo que cualquier intento se rechaza.
    expect(await castVote(db.pool, jurors[0], roundId, "RECHAZA")).toMatchObject({
      ok: false,
      error: "RONDA_NO_EN_VOTACION",
    });
    expect(await countVerdicts(db.pool, roundId)).toBe(4);
  });

  it("rejects a round that does not exist", async () => {
    const [juror] = await getJurorIds(db.pool);

    expect(await castVote(db.pool, juror, 999999, "RESPALDA")).toEqual({
      ok: false,
      error: "RONDA_NO_EXISTE",
    });
  });
});

describe("fn_registrar_voto: one definitive vote per juror", () => {
  it("rejects a second vote from the same juror and keeps the first decision", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const [juror] = await getJurorIds(db.pool);

    expect(await castVote(db.pool, juror, roundId, "RESPALDA")).toEqual({ ok: true });
    expect(await castVote(db.pool, juror, roundId, "RECHAZA")).toEqual({
      ok: false,
      error: "VOTO_DUPLICADO",
    });

    const { rows } = await db.pool.query<{ decision: string }>(
      "select decision from veredicto where id_jurado = $1 and id_ronda = $2",
      [juror, roundId],
    );
    expect(rows).toEqual([{ decision: "RESPALDA" }]);
  });

  it("stores exactly one vote when the same juror votes twice in parallel", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const [juror] = await getJurorIds(db.pool);

    const results = await Promise.all([
      castVote(db.pool, juror, roundId, "RESPALDA"),
      castVote(db.pool, juror, roundId, "RESPALDA"),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => result.error === "VOTO_DUPLICADO")).toHaveLength(1);
    expect(await countVerdicts(db.pool, roundId)).toBe(1);
  });

  it("allows each juror to vote once in the same round", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const jurors = await getJurorIds(db.pool);

    const results = await Promise.all(
      jurors.map((juror) => castVote(db.pool, juror, roundId, "RESPALDA")),
    );

    expect(results.every((result) => result.ok)).toBe(true);
    expect(await countVerdicts(db.pool, roundId)).toBe(jurors.length);
  });

  it("accepts a vote from the same juror in a different round", async () => {
    const operatorId = await getOperatorId(db.pool);
    const first = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, first.roundId);
    const [juror] = await getJurorIds(db.pool);
    expect(await castVote(db.pool, juror, first.roundId, "RESPALDA")).toEqual({ ok: true });

    // Se anula la primera ronda para liberar el mercado y abrir la segunda.
    expect(
      await operatorAction(db.pool, operatorId, first.roundId, "ANULAR_DEVOLVER"),
    ).toMatchObject({ ok: true });
    const secondRound = await getRoundId(db.pool, 2);
    await openRound(db.pool, operatorId, secondRound);
    await closeForVoting(db.pool, operatorId, secondRound);

    expect(await castVote(db.pool, juror, secondRound, "RECHAZA")).toEqual({ ok: true });
  });
});

describe("fn_registrar_voto: input validation", () => {
  it.each(["VOTA_SI", "respalda", ""])("rejects the invalid decision %j without writing", async (decision) => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const [juror] = await getJurorIds(db.pool);

    expect(await castVote(db.pool, juror, roundId, decision)).toEqual({
      ok: false,
      error: "DECISION_INVALIDA",
    });
    expect(await countVerdicts(db.pool, roundId)).toBe(0);
  });

  it("rejects a juror that does not exist", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    expect(await castVote(db.pool, 999999, roundId, "RESPALDA")).toEqual({
      ok: false,
      error: "JURADO_NO_EXISTE",
    });
    expect(await countVerdicts(db.pool, roundId)).toBe(0);
  });

  it("records an abstention as a valid decision", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const [juror] = await getJurorIds(db.pool);

    expect(await castVote(db.pool, juror, roundId, "SE_ABSTIENE")).toEqual({ ok: true });
    const { rows } = await db.pool.query<{ decision: string }>(
      "select decision from veredicto where id_jurado = $1 and id_ronda = $2",
      [juror, roundId],
    );
    expect(rows[0].decision).toBe("SE_ABSTIENE");
  });
});
