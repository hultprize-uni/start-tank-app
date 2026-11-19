/**
 * Pruebas de integración de fn_registrar_inversion (especificación, secciones 2.1 y 2.2).
 */
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  type FunctionResult,
  closeForVoting,
  createUser,
  getBalance,
  getInvestments,
  getOperatorId,
  getPriceRow,
  getRoundId,
  invest,
  openRoundNumber,
  operatorAction,
  waitForLockWait,
} from "./helpers/fixtures";

const db = registerTestDatabase();

describe("fn_registrar_inversion: purchase rules", () => {
  it("rejects an amount below the 250 minimum without changing the balance or rows", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool);

    const result = await invest(db.pool, user, roundId, 249.99);

    expect(result).toEqual({ ok: false, error: "MONTO_MINIMO", saldo: null });
    expect(await getBalance(db.pool, user)).toBe(10000);
    expect(await getInvestments(db.pool, roundId)).toHaveLength(0);
  });

  it("accepts an investment of exactly 250", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool);

    const result = await invest(db.pool, user, roundId, 250);

    expect(result).toEqual({ ok: true, saldo: 9750 });
    expect(await getBalance(db.pool, user)).toBe(9750);
  });

  it("rejects a purchase that exceeds 30 percent of the balance at opening", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool, { balance: 10000 });

    const result = await invest(db.pool, user, roundId, 3000.01);

    expect(result).toMatchObject({ ok: false, error: "TOPE_RONDA_SUPERADO" });
    expect(await getBalance(db.pool, user)).toBe(10000);
  });

  it("accepts purchases up to the 30 percent cap and rejects the next one", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool, { balance: 10000 });

    expect(await invest(db.pool, user, roundId, 1000)).toMatchObject({ ok: true });
    expect(await invest(db.pool, user, roundId, 2000)).toMatchObject({ ok: true });
    expect(await invest(db.pool, user, roundId, 250)).toMatchObject({
      ok: false,
      error: "TOPE_RONDA_SUPERADO",
    });
    expect(await getBalance(db.pool, user)).toBe(7000);
  });

  it("computes the cap from the balance at opening, including amounts already invested", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool, { balance: 5000 });

    // Tope de la ronda: 30 % de 5,000 = 1,500.
    expect(await invest(db.pool, user, roundId, 1500)).toMatchObject({ ok: true, saldo: 3500 });
    expect(await invest(db.pool, user, roundId, 250)).toMatchObject({
      ok: false,
      error: "TOPE_RONDA_SUPERADO",
    });
  });

  it("never leaves the balance negative when a purchase exceeds the available balance", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool, { balance: 300 });

    // Con el tope del 30 %, la compra de 250 supera el tope (90) antes de comprobar el saldo.
    const result = await invest(db.pool, user, roundId, 250);

    expect(result.ok).toBe(false);
    expect(["TOPE_RONDA_SUPERADO", "SALDO_INSUFICIENTE"]).toContain(result.error);
    expect(await getBalance(db.pool, user)).toBe(300);
    expect(await getInvestments(db.pool, roundId)).toHaveLength(0);
  });

  it("rejects investments once the round is in voting", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await closeForVoting(db.pool, operatorId, roundId);
    const user = await createUser(db.pool);

    const result = await invest(db.pool, user, roundId, 250);

    expect(result).toEqual({ ok: false, error: "RONDA_NO_ABIERTA", saldo: null });
    expect(await getBalance(db.pool, user)).toBe(10000);
    expect(await getInvestments(db.pool, roundId)).toHaveLength(0);
  });

  it("rejects investments in a round that has not been opened", async () => {
    const roundId = await getRoundId(db.pool, 1);
    const user = await createUser(db.pool);

    expect(await invest(db.pool, user, roundId, 250)).toMatchObject({
      ok: false,
      error: "RONDA_NO_ABIERTA",
    });
  });

  it("accepts investments while the round is in its last call", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    expect(await operatorAction(db.pool, operatorId, roundId, "ULTIMA_LLAMADA")).toMatchObject({
      ok: true,
      estado: "ULTIMA_LLAMADA",
    });
    const user = await createUser(db.pool);

    expect(await invest(db.pool, user, roundId, 250)).toMatchObject({ ok: true });
  });

  it("rejects a round that does not exist", async () => {
    const user = await createUser(db.pool);

    expect(await invest(db.pool, user, 999999, 250)).toMatchObject({
      ok: false,
      error: "RONDA_NO_EXISTE",
    });
  });

  it("rejects a user that does not exist", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);

    expect(await invest(db.pool, 999999, roundId, 250)).toMatchObject({
      ok: false,
      error: "USUARIO_NO_EXISTE",
    });
  });

  it("rejects a user whose account is not active", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool, { state: "INACTIVO" });

    expect(await invest(db.pool, user, roundId, 250)).toMatchObject({
      ok: false,
      error: "USUARIO_INACTIVO",
    });
    expect(await getBalance(db.pool, user)).toBe(10000);
  });

  it("records the purchase at the live price and debits the exact amount", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool);

    await invest(db.pool, user, roundId, 500);

    const [investment] = await getInvestments(db.pool, roundId);
    expect(investment).toMatchObject({
      userId: user,
      amount: 500,
      priceAtPurchase: 100,
      returnAmount: null,
      state: "REGISTRADA",
    });
    expect(await getBalance(db.pool, user)).toBe(9500);
  });
});

describe("fn_registrar_inversion: live price", () => {
  it("moves the price by cumulative amount, not by number of operations", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundOne = await openRoundNumber(db.pool, 1);
    const buyerA = await createUser(db.pool);

    // Diez compras de 250 suman 2,500 coins.
    for (let index = 0; index < 10; index += 1) {
      expect(await invest(db.pool, buyerA, roundOne.roundId, 250)).toMatchObject({ ok: true });
    }
    const afterTenPurchases = await getPriceRow(db.pool, roundOne.roundId);
    expect(afterTenPurchases.montoAcumulado).toBe(2500);
    expect(afterTenPurchases.precioVivo).toBe(101.25);

    // La ronda se anula con devolución para liberar el mercado y abrir la siguiente.
    expect(
      await operatorAction(db.pool, operatorId, roundOne.roundId, "ANULAR_DEVOLVER"),
    ).toMatchObject({ ok: true, estado: "ANULADA" });

    const roundTwo = await openRoundNumber(db.pool, 2);
    const buyerB = await createUser(db.pool);
    expect(await invest(db.pool, buyerB, roundTwo.roundId, 2500)).toMatchObject({ ok: true });

    const afterSinglePurchase = await getPriceRow(db.pool, roundTwo.roundId);
    expect(afterSinglePurchase.montoAcumulado).toBe(2500);
    expect(afterSinglePurchase.precioVivo).toBe(afterTenPurchases.precioVivo);
  });

  it("clamps the live price at 200 when the cumulative amount is large", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const whale = await createUser(db.pool, { balance: 1000000 });

    // 100 + 220,000 / 2,000 = 210, valor que se acota a 200.
    expect(await invest(db.pool, whale, roundId, 220000)).toMatchObject({ ok: true });
    expect((await getPriceRow(db.pool, roundId)).precioVivo).toBe(200);

    const next = await createUser(db.pool);
    expect(await invest(db.pool, next, roundId, 250)).toMatchObject({ ok: true });
    const [, second] = await getInvestments(db.pool, roundId);
    expect(second.priceAtPurchase).toBe(200);
  });

  it("counts distinct investors and accumulates the amount per round", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const first = await createUser(db.pool);
    const second = await createUser(db.pool);

    await invest(db.pool, first, roundId, 250);
    await invest(db.pool, first, roundId, 250);
    await invest(db.pool, second, roundId, 500);

    const price = await getPriceRow(db.pool, roundId);
    expect(price.montoAcumulado).toBe(1000);
    expect(price.inversoresUnicos).toBe(2);
  });
});

describe("fn_registrar_inversion: concurrency", () => {
  it("does not spend the same balance twice when a second purchase starts before the first commits", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool, { balance: 10000 });

    // La primera compra queda sin confirmar y conserva los bloqueos de la transacción.
    const first = await db.pool.connect();
    let firstResult: FunctionResult;
    let secondPurchase: Promise<FunctionResult>;
    try {
      await first.query("begin");
      const { rows } = await first.query<{ resultado: FunctionResult }>(
        "select fn_registrar_inversion($1, $2, $3) as resultado",
        [user, roundId, 2000],
      );
      firstResult = rows[0].resultado;

      // Cada compra por separado respeta el tope de 3,000; juntas lo superan.
      secondPurchase = invest(db.pool, user, roundId, 2000);
      await waitForLockWait(db.pool);
      await first.query("commit");
    } catch (error) {
      await first.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      first.release();
    }
    const second = await secondPurchase;

    expect(firstResult).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: false, error: "TOPE_RONDA_SUPERADO" });
    expect(await getBalance(db.pool, user)).toBe(8000);
    expect(await getInvestments(db.pool, roundId)).toHaveLength(1);
  });

  it("applies every purchase exactly once when ten purchases run in parallel", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    const user = await createUser(db.pool, { balance: 10000 });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => invest(db.pool, user, roundId, 250)),
    );

    expect(results.every((result) => result.ok)).toBe(true);
    expect(await getBalance(db.pool, user)).toBe(7500);
    const investments = await getInvestments(db.pool, roundId);
    expect(investments).toHaveLength(10);
    expect(investments.reduce((sum, row) => sum + row.amount, 0)).toBe(2500);
    expect((await getPriceRow(db.pool, roundId)).montoAcumulado).toBe(2500);
  });
});
