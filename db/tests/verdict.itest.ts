/**
 * Pruebas de integración de fn_revelar_veredicto (especificación, secciones 2.5 y 2.7).
 */
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  type Decision,
  castVote,
  closeForVoting,
  getBalance,
  getJurorIds,
  getOperatorId,
  getRoundMultiplier,
  getRoundState,
  invest,
  openRoundNumber,
  operatorAction,
  reveal,
  settleRound,
  createUser,
} from "./helpers/fixtures";

const db = registerTestDatabase();

/** Construye las decisiones de los cuatro jurados con la cantidad indicada de cada tipo. */
function decisionsFor(backing: number, rejecting: number, abstaining = 0): Decision[] {
  return [
    ...Array<Decision>(backing).fill("RESPALDA"),
    ...Array<Decision>(rejecting).fill("RECHAZA"),
    ...Array<Decision>(abstaining).fill("SE_ABSTIENE"),
  ];
}

async function countRevealActions(pool: Pool, roundId: number): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    "select count(*)::int as total from accion_ronda where id_ronda = $1 and accion = 'REVELAR'",
    [roundId],
  );
  return rows[0].total;
}

describe("fn_revelar_veredicto: reveal gating", () => {
  it("blocks the reveal while any juror has not voted", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const jurors = await getJurorIds(db.pool);
    for (const juror of jurors.slice(0, 3)) {
      await castVote(db.pool, juror, roundId, "RESPALDA");
    }

    expect(await reveal(db.pool, operatorId, roundId)).toEqual({
      ok: false,
      error: "VOTOS_PENDIENTES",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
    expect(await getRoundMultiplier(db.pool, roundId)).toBeNull();
    expect(await countRevealActions(db.pool, roundId)).toBe(0);
  });

  it("allows the reveal once every juror has voted", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const jurors = await getJurorIds(db.pool);
    for (const juror of jurors.slice(0, 3)) {
      await castVote(db.pool, juror, roundId, "RESPALDA");
    }
    await castVote(db.pool, jurors[3], roundId, "RECHAZA");

    expect(await reveal(db.pool, operatorId, roundId)).toMatchObject({ ok: true });
    expect(await getRoundState(db.pool, roundId)).toBe("LIQUIDADA");
  });

  it("registers the reveal as an operator action with the operator identifier", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    await settleRound(db.pool, operatorId, roundId, decisionsFor(2, 2));

    const { rows } = await db.pool.query<{ id_operador: string; accion: string }>(
      "select id_operador, accion from accion_ronda where id_ronda = $1 and accion = 'REVELAR'",
      [roundId],
    );
    expect(rows).toEqual([{ id_operador: String(operatorId), accion: "REVELAR" }]);
  });

  it("rejects the reveal while the round is closed and voting is not enabled", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    expect(await operatorAction(db.pool, operatorId, roundId, "CERRAR")).toMatchObject({ ok: true });

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

    expect(await reveal(db.pool, 999999, roundId)).toEqual({
      ok: false,
      error: "OPERADOR_NO_EXISTE",
    });
  });

  it("rejects a round that does not exist", async () => {
    const operatorId = await getOperatorId(db.pool);

    expect(await reveal(db.pool, operatorId, 999999)).toEqual({
      ok: false,
      error: "RONDA_NO_EXISTE",
    });
  });

  it("rejects the reveal when the event has no jurors", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    await db.pool.query("delete from jurado");

    expect(await reveal(db.pool, operatorId, roundId)).toEqual({
      ok: false,
      error: "SIN_JURADOS",
    });
  });

  it("rejects the reveal when every juror abstains", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    // Los cuatro votos son abstenciones: no existe fracción de respaldo que calcular.
    await settleRound(db.pool, operatorId, roundId, decisionsFor(0, 0, 4));

    expect(await reveal(db.pool, operatorId, roundId)).toEqual({
      ok: false,
      error: "SIN_VOTOS_EMITIDOS",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });
});

describe("fn_revelar_veredicto: multiplier", () => {
  it.each([
    [0, 0, 0.2],
    [1, 0.25, 0.6],
    [2, 0.5, 1],
    [3, 0.75, 1.4],
    [4, 1, 1.8],
  ])(
    "computes 0.2 + 1.6 x fraction for %i backing votes out of four",
    async (backing, fraction, multiplier) => {
      const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
      await closeForVoting(db.pool, operatorId, roundId);

      const result = await settleRound(
        db.pool,
        operatorId,
        roundId,
        decisionsFor(backing, 4 - backing),
      );

      expect(result).toMatchObject({
        ok: true,
        multiplicador: multiplier,
        fraccion_respaldo: fraction,
      });
      expect(await getRoundMultiplier(db.pool, roundId)).toBe(multiplier);
    },
  );

  it("excludes abstentions from the denominator", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    // Dos respaldos entre tres votos emitidos: fracción 0.6667 y multiplicador 1.267.
    const result = await settleRound(db.pool, operatorId, roundId, decisionsFor(2, 1, 1));

    expect(result).toMatchObject({ ok: true, multiplicador: 1.267, fraccion_respaldo: 0.6667 });
  });

  it("returns 1.8x when three jurors back the startup and one abstains", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    const result = await settleRound(db.pool, operatorId, roundId, decisionsFor(3, 0, 1));

    expect(result).toMatchObject({ ok: true, multiplicador: 1.8, fraccion_respaldo: 1 });
  });

  it("returns 0.2x when no juror backs the startup and one abstains", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);

    const result = await settleRound(db.pool, operatorId, roundId, decisionsFor(0, 3, 1));

    expect(result).toMatchObject({ ok: true, multiplicador: 0.2, fraccion_respaldo: 0 });
  });
});

describe("fn_revelar_veredicto: idempotency", () => {
  it("returns the current result and changes nothing when the round is revealed again", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool);
    await invest(db.pool, user, roundId, 1000);
    await closeForVoting(db.pool, operatorId, roundId);
    const first = await settleRound(db.pool, operatorId, roundId, decisionsFor(3, 1));
    const balanceAfterFirst = await getBalance(db.pool, user);

    const second = await reveal(db.pool, operatorId, roundId);

    expect(first).toMatchObject({ ok: true, multiplicador: 1.4 });
    expect(second).toEqual({ ok: true, multiplicador: 1.4, idempotente: true });
    expect(await getBalance(db.pool, user)).toBe(balanceAfterFirst);
    expect(balanceAfterFirst).toBe(10400);
    expect(await countRevealActions(db.pool, roundId)).toBe(1);
  });

  it("keeps the previous multiplier after the round is settled", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    await settleRound(db.pool, operatorId, roundId, decisionsFor(4, 0));

    // Una nueva revelación devuelve el resultado vigente y la ronda conserva su multiplicador.
    expect(await reveal(db.pool, operatorId, roundId)).toMatchObject({
      ok: true,
      multiplicador: 1.8,
      idempotente: true,
    });
    expect(await getRoundMultiplier(db.pool, roundId)).toBe(1.8);
  });
});
