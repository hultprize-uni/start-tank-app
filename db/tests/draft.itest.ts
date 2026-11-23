/**
 * Pruebas de integración de fn_guardar_borrador: el borrador guarda la última nota de cada
 * criterio mientras el jurado califica, y se rechaza cuando ya no corresponde.
 */
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  castVote,
  closeForVoting,
  getCriterionIds,
  getJurorIds,
  getRoundId,
  openRoundNumber,
  operatorAction,
  saveDraft,
} from "./helpers/fixtures";

const db = registerTestDatabase();

async function draftValues(pool: Pool, jurorId: number, roundId: number): Promise<Record<number, number>> {
  const { rows } = await pool.query<{ id_criterio: string; valor: number }>(
    "select id_criterio, valor from borrador_nota where id_jurado = $1 and id_ronda = $2",
    [jurorId, roundId],
  );
  return Object.fromEntries(rows.map((row) => [Number(row.id_criterio), row.valor]));
}

describe("fn_guardar_borrador", () => {
  it("saves a note and replaces it when the juror changes their mind", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const [juror] = await getJurorIds(db.pool);
    const [criterion] = await getCriterionIds(db.pool);

    expect(await saveDraft(db.pool, juror, roundId, criterion, 2)).toEqual({ ok: true });
    expect(await saveDraft(db.pool, juror, roundId, criterion, 5)).toEqual({ ok: true });

    expect(await draftValues(db.pool, juror, roundId)).toEqual({ [criterion]: 5 });
  });

  it("keeps drafts of different criteria and different jurors apart", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const [first, second] = await getJurorIds(db.pool);
    const [criterionA, criterionB] = await getCriterionIds(db.pool);

    await saveDraft(db.pool, first, roundId, criterionA, 3);
    await saveDraft(db.pool, first, roundId, criterionB, 4);
    await saveDraft(db.pool, second, roundId, criterionA, 1);

    expect(await draftValues(db.pool, first, roundId)).toEqual({ [criterionA]: 3, [criterionB]: 4 });
    expect(await draftValues(db.pool, second, roundId)).toEqual({ [criterionA]: 1 });
  });

  it("accepts drafts while the round is open, closed or in voting", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    const [juror] = await getJurorIds(db.pool);
    const [criterion] = await getCriterionIds(db.pool);

    expect(await saveDraft(db.pool, juror, roundId, criterion, 3)).toMatchObject({ ok: true });
    await operatorAction(db.pool, operatorId, roundId, "CERRAR");
    expect(await saveDraft(db.pool, juror, roundId, criterion, 4)).toMatchObject({ ok: true });
    await operatorAction(db.pool, operatorId, roundId, "HABILITAR_VOTO");
    expect(await saveDraft(db.pool, juror, roundId, criterion, 5)).toMatchObject({ ok: true });
  });

  it("rejects drafts for a round that has not started", async () => {
    const roundId = await getRoundId(db.pool, 1);
    const [juror] = await getJurorIds(db.pool);
    const [criterion] = await getCriterionIds(db.pool);

    expect(await saveDraft(db.pool, juror, roundId, criterion, 3)).toEqual({
      ok: false,
      error: "RONDA_NO_CALIFICABLE",
    });
  });

  it("rejects drafts after the juror submitted the verdict", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const [juror] = await getJurorIds(db.pool);
    const [criterion] = await getCriterionIds(db.pool);
    await castVote(db.pool, juror, roundId, 4);

    expect(await saveDraft(db.pool, juror, roundId, criterion, 1)).toEqual({
      ok: false,
      error: "YA_ENVIO",
    });
    expect(await draftValues(db.pool, juror, roundId)).toEqual({});
  });

  it.each([0, 6, -1])("rejects the note %i", async (value) => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const [juror] = await getJurorIds(db.pool);
    const [criterion] = await getCriterionIds(db.pool);

    expect(await saveDraft(db.pool, juror, roundId, criterion, value)).toEqual({
      ok: false,
      error: "NOTA_INVALIDA",
    });
  });

  it("rejects a juror, a criterion or a round that does not exist", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const [juror] = await getJurorIds(db.pool);
    const [criterion] = await getCriterionIds(db.pool);

    expect(await saveDraft(db.pool, 999999, roundId, criterion, 3)).toMatchObject({
      error: "JURADO_NO_EXISTE",
    });
    expect(await saveDraft(db.pool, juror, roundId, 999999, 3)).toMatchObject({
      error: "CRITERIO_NO_EXISTE",
    });
    expect(await saveDraft(db.pool, juror, 999999, criterion, 3)).toMatchObject({
      error: "RONDA_NO_EXISTE",
    });
  });
});
