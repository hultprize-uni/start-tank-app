/**
 * Pruebas de integración de fn_registrar_voto v2: el jurado envía una nota por criterio o se
 * abstiene, el puntaje es el promedio ponderado y el envío es definitivo.
 */
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  castVote,
  closeForVoting,
  getCriterionIds,
  getJurorIds,
  getOperatorId,
  getRoundId,
  getRoundState,
  openRound,
  openRoundNumber,
  operatorAction,
  saveDraft,
  settleRound,
  submitVerdict,
} from "./helpers/fixtures";

const db = registerTestDatabase();

async function countVerdicts(pool: Pool, roundId: number): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    "select count(*)::int as total from veredicto where id_ronda = $1",
    [roundId],
  );
  return rows[0].total;
}

async function countNotes(pool: Pool, roundId: number): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    `select count(*)::int as total
       from nota_criterio n
       join veredicto v on v.id_veredicto = n.id_veredicto
      where v.id_ronda = $1`,
    [roundId],
  );
  return rows[0].total;
}

/** Deja la ronda 1 en votación y devuelve los datos que usan casi todas las pruebas. */
async function votingRound(): Promise<{ operatorId: number; roundId: number; juror: number; criteria: number[] }> {
  const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
  await closeForVoting(db.pool, operatorId, roundId);
  const [juror] = await getJurorIds(db.pool);
  return { operatorId, roundId, juror, criteria: await getCriterionIds(db.pool) };
}

describe("fn_registrar_voto: voting window", () => {
  it("accepts a vote while the round is in voting", async () => {
    const { roundId, juror } = await votingRound();

    expect(await castVote(db.pool, juror, roundId, 4)).toEqual({ ok: true, puntaje: 4 });
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

    expect(await castVote(db.pool, juror, roundId, 4)).toEqual({
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

    expect(await castVote(db.pool, juror, roundId, 2)).toMatchObject({
      ok: false,
      error: "RONDA_NO_EN_VOTACION",
    });
    expect(await countVerdicts(db.pool, roundId)).toBe(0);
  });

  it("rejects votes once the verdict has been revealed", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    const jurors = await getJurorIds(db.pool);
    await closeForVoting(db.pool, operatorId, roundId);
    await settleRound(db.pool, operatorId, roundId, [5, 5, 5, 5]);

    expect(await castVote(db.pool, jurors[0], roundId, 1)).toMatchObject({
      ok: false,
      error: "RONDA_NO_EN_VOTACION",
    });
    expect(await countVerdicts(db.pool, roundId)).toBe(4);
  });

  it("rejects a round that does not exist", async () => {
    const [juror] = await getJurorIds(db.pool);

    expect(await castVote(db.pool, juror, 999999, 4)).toEqual({ ok: false, error: "RONDA_NO_EXISTE" });
  });
});

describe("fn_registrar_voto: one definitive vote per juror", () => {
  it("rejects a second vote from the same juror and keeps the first score", async () => {
    const { roundId, juror } = await votingRound();

    expect(await castVote(db.pool, juror, roundId, 5)).toEqual({ ok: true, puntaje: 5 });
    expect(await castVote(db.pool, juror, roundId, 1)).toEqual({ ok: false, error: "VOTO_DUPLICADO" });

    const { rows } = await db.pool.query<{ puntaje: string }>(
      "select puntaje from veredicto where id_jurado = $1 and id_ronda = $2",
      [juror, roundId],
    );
    expect(rows.map((row) => Number(row.puntaje))).toEqual([5]);
  });

  it("stores exactly one vote when the same juror votes twice in parallel", async () => {
    const { roundId, juror } = await votingRound();

    const results = await Promise.all([
      castVote(db.pool, juror, roundId, 4),
      castVote(db.pool, juror, roundId, 4),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => result.error === "VOTO_DUPLICADO")).toHaveLength(1);
    expect(await countVerdicts(db.pool, roundId)).toBe(1);
  });

  it("allows each juror to vote once in the same round", async () => {
    const { roundId } = await votingRound();
    const jurors = await getJurorIds(db.pool);

    const results = await Promise.all(jurors.map((juror) => castVote(db.pool, juror, roundId, 4)));

    expect(results.every((result) => result.ok)).toBe(true);
    expect(await countVerdicts(db.pool, roundId)).toBe(jurors.length);
  });

  it("accepts a vote from the same juror in a different round", async () => {
    const { operatorId, roundId, juror } = await votingRound();
    expect(await castVote(db.pool, juror, roundId, 4)).toMatchObject({ ok: true });

    await operatorAction(db.pool, operatorId, roundId, "ANULAR_DEVOLVER");
    const secondRound = await getRoundId(db.pool, 2);
    await openRound(db.pool, operatorId, secondRound);
    await closeForVoting(db.pool, operatorId, secondRound);

    expect(await castVote(db.pool, juror, secondRound, 2)).toMatchObject({ ok: true });
  });
});

describe("fn_registrar_voto: scoring", () => {
  it("stores one note per criterion and the weighted average as the score", async () => {
    const { roundId, juror, criteria } = await votingRound();
    const notes = criteria.map((id, index) => ({ id_criterio: id, valor: [5, 4, 3, 4][index] }));

    // Con pesos iguales, el promedio de 5, 4, 3 y 4 es 4.
    expect(await submitVerdict(db.pool, juror, roundId, { notes })).toEqual({ ok: true, puntaje: 4 });

    expect(await countNotes(db.pool, roundId)).toBe(criteria.length);
  });

  it("weights the notes by criterion weight", async () => {
    const { roundId, juror, criteria } = await votingRound();
    await db.pool.query("update criterio set peso = 0.7 where id_criterio = $1", [criteria[0]]);
    await db.pool.query("update criterio set peso = 0.1 where id_criterio <> $1", [criteria[0]]);
    const notes = criteria.map((id, index) => ({ id_criterio: id, valor: index === 0 ? 5 : 1 }));

    // (5 x 0.7 + 1 x 0.1 x 3) / 1.0 = 3.8
    expect(await submitVerdict(db.pool, juror, roundId, { notes })).toEqual({ ok: true, puntaje: 3.8 });
  });

  it("records an abstention without notes and without a score", async () => {
    const { roundId, juror } = await votingRound();

    expect(await castVote(db.pool, juror, roundId, "ABSTIENE")).toEqual({ ok: true, puntaje: null });

    const { rows } = await db.pool.query<{ se_abstiene: boolean; puntaje: string | null }>(
      "select se_abstiene, puntaje from veredicto where id_jurado = $1 and id_ronda = $2",
      [juror, roundId],
    );
    expect(rows).toEqual([{ se_abstiene: true, puntaje: null }]);
    expect(await countNotes(db.pool, roundId)).toBe(0);
  });

  it("deletes the juror's draft once the verdict is submitted", async () => {
    const { roundId, juror, criteria } = await votingRound();
    await saveDraft(db.pool, juror, roundId, criteria[0], 3);

    await castVote(db.pool, juror, roundId, 4);

    const { rows } = await db.pool.query<{ total: number }>(
      "select count(*)::int as total from borrador_nota where id_jurado = $1 and id_ronda = $2",
      [juror, roundId],
    );
    expect(rows[0].total).toBe(0);
  });
});

describe("fn_registrar_voto: input validation", () => {
  it("rejects a submission that leaves a criterion without a note", async () => {
    const { roundId, juror, criteria } = await votingRound();
    const notes = criteria.slice(1).map((id) => ({ id_criterio: id, valor: 4 }));

    expect(await submitVerdict(db.pool, juror, roundId, { notes })).toEqual({
      ok: false,
      error: "NOTAS_INCOMPLETAS",
    });
    expect(await countVerdicts(db.pool, roundId)).toBe(0);
  });

  it("rejects a submission that repeats a criterion", async () => {
    const { roundId, juror, criteria } = await votingRound();
    const notes = [criteria[0], criteria[0], criteria[1], criteria[2]].map((id) => ({
      id_criterio: id,
      valor: 4,
    }));

    expect(await submitVerdict(db.pool, juror, roundId, { notes })).toEqual({
      ok: false,
      error: "NOTAS_INCOMPLETAS",
    });
  });

  it("rejects a note outside the 1 to 5 range", async () => {
    const { roundId, juror, criteria } = await votingRound();
    const notes = criteria.map((id, index) => ({ id_criterio: id, valor: index === 0 ? 6 : 3 }));

    expect(await submitVerdict(db.pool, juror, roundId, { notes })).toEqual({
      ok: false,
      error: "NOTAS_INCOMPLETAS",
    });
    expect(await countVerdicts(db.pool, roundId)).toBe(0);
  });

  it("rejects a criterion that does not exist", async () => {
    const { roundId, juror, criteria } = await votingRound();
    const notes = criteria.map((id, index) => ({ id_criterio: index === 0 ? 999999 : id, valor: 3 }));

    expect(await submitVerdict(db.pool, juror, roundId, { notes })).toEqual({
      ok: false,
      error: "NOTAS_INCOMPLETAS",
    });
  });

  it("rejects notes that are not a JSON array", async () => {
    const { roundId, juror } = await votingRound();

    expect(await submitVerdict(db.pool, juror, roundId, { notes: { valor: 4 } })).toEqual({
      ok: false,
      error: "NOTAS_INVALIDAS",
    });
  });

  it("rejects a juror that does not exist", async () => {
    const { roundId } = await votingRound();

    expect(await castVote(db.pool, 999999, roundId, 4)).toEqual({ ok: false, error: "JURADO_NO_EXISTE" });
    expect(await countVerdicts(db.pool, roundId)).toBe(0);
  });
});
