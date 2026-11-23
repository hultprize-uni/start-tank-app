/**
 * Pruebas de integración de la liquidación de rondas: saldos, leaderboard y anulaciones.
 * Ejercitan fn_revelar_veredicto, fn_liquidar_ronda y fn_accion_operador.
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
  getInvestments,
  getJurorIds,
  getLeaderboard,
  getOperatorId,
  getPriceRow,
  getRoundId,
  getRoundState,
  invest,
  openRound,
  openRoundNumber,
  operatorAction,
  settleRound,
} from "./helpers/fixtures";

const db = registerTestDatabase();

interface Purchase {
  userId: number;
  amount: number;
}

/**
 * Puntaje unánime de los cuatro jurados. Con pesos iguales el multiplicador resulta de
 * 0.2 + 0.4 x (puntaje - 1): 1 da 0.2x, 2 da 0.6x, 3 da 1.0x, 4 da 1.4x y 5 da 1.8x.
 */
function unanimous(score: number): Score[] {
  return [score, score, score, score];
}

/**
 * Ejecuta una ronda completa: abre el mercado, registra las compras, cierra la votación, registra
 * los votos y revela el veredicto. Devuelve el identificador de la ronda y el resultado.
 */
async function playRound(
  pool: Pool,
  number: number,
  purchases: Purchase[],
  scores: Score[],
): Promise<{ roundId: number; result: Awaited<ReturnType<typeof settleRound>> }> {
  const operatorId = await getOperatorId(pool);
  const roundId = await getRoundId(pool, number);
  await openRound(pool, operatorId, roundId);
  for (const purchase of purchases) {
    const outcome = await invest(pool, purchase.userId, roundId, purchase.amount);
    if (!outcome.ok) {
      throw new Error(`Compra rechazada en la ronda ${number}: ${outcome.error}`);
    }
  }
  await closeForVoting(pool, operatorId, roundId);
  const result = await settleRound(pool, operatorId, roundId, scores);
  return { roundId, result };
}

describe("settlement: balances", () => {
  it("credits the amount times the multiplier", async () => {
    const user = await createUser(db.pool);
    const { roundId, result } = await playRound(
      db.pool,
      1,
      [{ userId: user, amount: 2000 }],
      unanimous(4),
    );

    expect(result).toMatchObject({ ok: true, multiplicador: 1.4 });
    expect(await getBalance(db.pool, user)).toBe(10800);
    const [investment] = await getInvestments(db.pool, roundId);
    expect(investment).toMatchObject({ returnAmount: 2800, state: "LIQUIDADA" });
  });

  it("credits 1200 on a 2000 investment at a multiplier of 0.6", async () => {
    const user = await createUser(db.pool);
    const { roundId } = await playRound(db.pool, 1, [{ userId: user, amount: 2000 }], unanimous(2));

    expect(await getBalance(db.pool, user)).toBe(9200);
    expect((await getInvestments(db.pool, roundId))[0].returnAmount).toBe(1200);
  });

  it("returns the invested amount when the multiplier is 1.0x", async () => {
    const user = await createUser(db.pool);
    await playRound(db.pool, 1, [{ userId: user, amount: 1000 }], unanimous(3));

    expect(await getBalance(db.pool, user)).toBe(10000);
  });

  it("credits every investor independently at the same multiplier", async () => {
    const first = await createUser(db.pool);
    const second = await createUser(db.pool);
    await playRound(
      db.pool,
      1,
      [
        { userId: first, amount: 1000 },
        { userId: second, amount: 2000 },
      ],
      unanimous(5),
    );

    // Multiplicador 1.8: 1,000 se convierte en 1,800 y 2,000 en 3,600.
    expect(await getBalance(db.pool, first)).toBe(10800);
    expect(await getBalance(db.pool, second)).toBe(11600);
  });

  it("credits the loss of 80 percent at the minimum score", async () => {
    const user = await createUser(db.pool);
    await playRound(db.pool, 1, [{ userId: user, amount: 1000 }], unanimous(1));

    expect(await getBalance(db.pool, user)).toBe(9200);
  });

  it("makes the returned cash available before the next round opens", async () => {
    const user = await createUser(db.pool);
    await playRound(db.pool, 1, [{ userId: user, amount: 1000 }], unanimous(1));

    // Saldo acreditado: 9,200. El tope de la ronda 2 es 30 % de 9,200 = 2,760.
    const nextRound = await getRoundId(db.pool, 2);
    await openRound(db.pool, await getOperatorId(db.pool), nextRound);
    expect(await invest(db.pool, user, nextRound, 2760)).toMatchObject({ ok: true, saldo: 6440 });
  });

  it("marks the round as settled with the multiplier stored", async () => {
    const user = await createUser(db.pool);
    const { roundId } = await playRound(db.pool, 1, [{ userId: user, amount: 250 }], unanimous(5));

    expect(await getRoundState(db.pool, roundId)).toBe("LIQUIDADA");
    const { rows } = await db.pool.query<{ multiplicador: string; liquidada_en: Date | null }>(
      "select multiplicador, liquidada_en from ronda where id_ronda = $1",
      [roundId],
    );
    expect(Number(rows[0].multiplicador)).toBe(1.8);
    expect(rows[0].liquidada_en).not.toBeNull();
  });
});

describe("settlement: leaderboard", () => {
  it("orders attendees by final balance, assigns positions and computes the round gain", async () => {
    const top = await createUser(db.pool);
    const middle = await createUser(db.pool);
    const bottom = await createUser(db.pool);
    const { roundId } = await playRound(
      db.pool,
      1,
      [
        { userId: top, amount: 2000 },
        { userId: middle, amount: 1000 },
      ],
      unanimous(4),
    );

    const board = await getLeaderboard(db.pool, roundId);
    expect(board.map((row) => [row.userId, row.position, row.balance])).toEqual([
      [top, 1, 10800],
      [middle, 2, 10400],
      [bottom, 3, 10000],
    ]);
    expect(board.map((row) => row.roundGain)).toEqual([800, 400, 0]);
  });

  it("counts a hit when the startup earns a multiplier above 1.0x", async () => {
    const investor = await createUser(db.pool);
    const bystander = await createUser(db.pool);
    const { roundId } = await playRound(db.pool, 1, [{ userId: investor, amount: 250 }], unanimous(4));

    const board = await getLeaderboard(db.pool, roundId);
    expect(board.find((row) => row.userId === investor)?.hits).toBe(1);
    expect(board.find((row) => row.userId === bystander)?.hits).toBe(0);
  });

  it("counts a hit for a multiplier just above 1.0x", async () => {
    const investor = await createUser(db.pool);
    // Promedio 3.25: multiplicador 1.1.
    const { roundId } = await playRound(db.pool, 1, [{ userId: investor, amount: 250 }], [4, 3, 3, 3]);

    expect((await getLeaderboard(db.pool, roundId)).find((row) => row.userId === investor)?.hits).toBe(1);
  });

  it("does not count a hit at exactly 1.0x or below", async () => {
    const investor = await createUser(db.pool);
    const { roundId } = await playRound(db.pool, 1, [{ userId: investor, amount: 250 }], unanimous(3));

    expect((await getLeaderboard(db.pool, roundId)).find((row) => row.userId === investor)?.hits).toBe(0);
  });

  it("accumulates hits across rounds and carries them for attendees who do not invest", async () => {
    const investor = await createUser(db.pool);
    const observer = await createUser(db.pool);

    await playRound(db.pool, 1, [{ userId: investor, amount: 250 }], unanimous(4));
    const second = await playRound(db.pool, 2, [{ userId: investor, amount: 250 }], unanimous(2));
    const third = await playRound(db.pool, 3, [{ userId: investor, amount: 250 }], unanimous(5));

    const boardTwo = await getLeaderboard(db.pool, second.roundId);
    expect(boardTwo.find((row) => row.userId === investor)?.hits).toBe(1);
    expect(boardTwo.find((row) => row.userId === observer)?.hits).toBe(0);

    const boardThree = await getLeaderboard(db.pool, third.roundId);
    expect(boardThree.find((row) => row.userId === investor)?.hits).toBe(2);
  });
});

describe("settlement: cancelled rounds", () => {
  it("returns the invested amounts and marks the round as cancelled", async () => {
    const operatorId = await getOperatorId(db.pool);
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool);
    await invest(db.pool, user, roundId, 1000);

    expect(await operatorAction(db.pool, operatorId, roundId, "ANULAR_DEVOLVER")).toEqual({
      ok: true,
      estado: "ANULADA",
    });

    expect(await getBalance(db.pool, user)).toBe(10000);
    expect(await getRoundState(db.pool, roundId)).toBe("ANULADA");
    const [investment] = await getInvestments(db.pool, roundId);
    expect(investment).toMatchObject({ returnAmount: 1000, state: "ANULADA" });
    const { rows } = await db.pool.query<{ multiplicador: string }>(
      "select multiplicador from ronda where id_ronda = $1",
      [roundId],
    );
    expect(Number(rows[0].multiplicador)).toBe(1);
  });

  it("settles a cancelled round at 1.0x when the operator chooses liquidation", async () => {
    const operatorId = await getOperatorId(db.pool);
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool);
    await invest(db.pool, user, roundId, 1500);

    expect(await operatorAction(db.pool, operatorId, roundId, "ANULAR_LIQUIDAR_1X")).toEqual({
      ok: true,
      estado: "LIQUIDADA",
    });

    expect(await getBalance(db.pool, user)).toBe(10000);
    expect(await getRoundState(db.pool, roundId)).toBe("LIQUIDADA");
    const [investment] = await getInvestments(db.pool, roundId);
    expect(investment).toMatchObject({ returnAmount: 1500, state: "LIQUIDADA" });
  });

  it.each(["ANULAR_DEVOLVER", "ANULAR_LIQUIDAR_1X"])("requires a reason for %s", async (action) => {
    const operatorId = await getOperatorId(db.pool);
    const { roundId } = await openRoundNumber(db.pool, 1);

    expect(await operatorAction(db.pool, operatorId, roundId, action, null)).toEqual({
      ok: false,
      error: "MOTIVO_REQUERIDO",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("ABIERTA");
  });

  it("logs the reason of the cancellation", async () => {
    const operatorId = await getOperatorId(db.pool);
    const { roundId } = await openRoundNumber(db.pool, 1);

    await operatorAction(db.pool, operatorId, roundId, "ANULAR_DEVOLVER", "Falla del proyector");

    const { rows } = await db.pool.query<{ motivo: string }>(
      "select motivo from accion_ronda where id_ronda = $1 and accion = 'ANULAR_DEVOLVER'",
      [roundId],
    );
    expect(rows).toEqual([{ motivo: "Falla del proyector" }]);
  });

  it("does not count hits when a round is cancelled, even if the votes would qualify", async () => {
    const operatorId = await getOperatorId(db.pool);
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool);
    await invest(db.pool, user, roundId, 250);
    await closeForVoting(db.pool, operatorId, roundId);
    for (const juror of await getJurorIds(db.pool)) {
      await castVote(db.pool, juror, roundId, 5);
    }

    expect(await operatorAction(db.pool, operatorId, roundId, "ANULAR_LIQUIDAR_1X")).toMatchObject({
      ok: true,
    });

    const board = await getLeaderboard(db.pool, roundId);
    expect(board.find((row) => row.userId === user)?.hits).toBe(0);
  });

  it("does not allow cancelling a round that is not active", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);

    expect(await operatorAction(db.pool, operatorId, roundId, "ANULAR_DEVOLVER")).toEqual({
      ok: false,
      error: "TRANSICION_NO_PERMITIDA",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("PROGRAMADA");
  });

  it("leaves the jury score empty for a cancelled round", async () => {
    const operatorId = await getOperatorId(db.pool);
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool);
    await invest(db.pool, user, roundId, 2500);

    await operatorAction(db.pool, operatorId, roundId, "ANULAR_DEVOLVER");

    const price = await getPriceRow(db.pool, roundId);
    expect(price.montoAcumulado).toBe(2500);
    expect(price.puntajeJurado).toBeNull();
    expect(price.puntaje).toBeNull();
  });
});
