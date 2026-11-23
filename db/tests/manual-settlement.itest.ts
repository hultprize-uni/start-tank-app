/**
 * Pruebas de integración de la liquidación manual (modo manual del conductor). Ejercitan
 * fn_liquidar_manual, que delega en fn_liquidar_ronda sin repetir la lógica de saldos.
 */
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  closeForVoting,
  createUser,
  getBalance,
  getOperatorId,
  getPriceRow,
  getRoundId,
  getRoundState,
  getSupportOperatorId,
  invest,
  manualSettle,
  openRoundNumber,
} from "./helpers/fixtures";

const db = registerTestDatabase();

/** Prepara una ronda con una inversión y la deja en EN_VOTACION, lista para liquidar. */
async function roundReadyForManualSettlement(): Promise<{ operatorId: number; roundId: number; investor: number }> {
  const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
  const investor = await createUser(db.pool);
  await invest(db.pool, investor, roundId, 2000);
  await closeForVoting(db.pool, operatorId, roundId);
  return { operatorId, roundId, investor };
}

describe("manual settlement: liquidación", () => {
  it("liquida con puntaje 4 y aplica el multiplicador 1.4", async () => {
    const { operatorId, roundId, investor } = await roundReadyForManualSettlement();

    expect(await manualSettle(db.pool, operatorId, roundId, 4)).toMatchObject({
      ok: true,
      multiplicador: 1.4,
      puntaje_jurado: 4,
    });

    expect(await getRoundState(db.pool, roundId)).toBe("LIQUIDADA");
    expect(await getBalance(db.pool, investor)).toBe(10800);
  });

  it("acepta puntajes con decimales", async () => {
    const { operatorId, roundId } = await roundReadyForManualSettlement();

    // 0.2 + 1.6 x (2.5 / 4) = 1.2
    expect(await manualSettle(db.pool, operatorId, roundId, 3.5)).toMatchObject({
      ok: true,
      multiplicador: 1.2,
    });
  });

  it("liquida también una ronda con el mercado cerrado y la votación sin habilitar", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await db.pool.query("select fn_accion_operador($1, $2, 'CERRAR')", [operatorId, roundId]);

    expect(await manualSettle(db.pool, operatorId, roundId, 3)).toMatchObject({ ok: true });
  });

  it("guarda el puntaje del jurado en la fila de la startup", async () => {
    const { operatorId, roundId } = await roundReadyForManualSettlement();

    await manualSettle(db.pool, operatorId, roundId, 4);

    expect((await getPriceRow(db.pool, roundId)).puntajeJurado).toBe(4);
  });

  it("registra la acción REVELAR_MANUAL con el motivo", async () => {
    const { operatorId, roundId } = await roundReadyForManualSettlement();

    await manualSettle(db.pool, operatorId, roundId, 2, "Falló el voto digital");

    const { rows } = await db.pool.query<{ accion: string; motivo: string }>(
      "select accion, motivo from accion_ronda where id_ronda = $1 order by id_accion desc limit 1",
      [roundId],
    );
    expect(rows[0]).toEqual({ accion: "REVELAR_MANUAL", motivo: "Falló el voto digital" });
  });

  it("no liquida una ronda dos veces", async () => {
    const { operatorId, roundId, investor } = await roundReadyForManualSettlement();
    await manualSettle(db.pool, operatorId, roundId, 4);

    expect(await manualSettle(db.pool, operatorId, roundId, 5)).toEqual({
      ok: false,
      error: "RONDA_YA_LIQUIDADA",
    });
    expect(await getBalance(db.pool, investor)).toBe(10800);
  });

  it.each([0.99, 5.01, -1])("rechaza el puntaje %f fuera del rango de 1 a 5", async (score) => {
    const { operatorId, roundId } = await roundReadyForManualSettlement();

    expect(await manualSettle(db.pool, operatorId, roundId, score)).toEqual({
      ok: false,
      error: "PUNTAJE_INVALIDO",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });

  it("exige un motivo", async () => {
    const { operatorId, roundId } = await roundReadyForManualSettlement();

    expect(await manualSettle(db.pool, operatorId, roundId, 4, null)).toEqual({
      ok: false,
      error: "MOTIVO_REQUERIDO",
    });
    expect(await manualSettle(db.pool, operatorId, roundId, 4, "   ")).toEqual({
      ok: false,
      error: "MOTIVO_REQUERIDO",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });

  it("rechaza un operador inexistente", async () => {
    const { roundId } = await roundReadyForManualSettlement();
    const operatorId = await getOperatorId(db.pool);

    expect(await manualSettle(db.pool, operatorId + 999, roundId, 4)).toEqual({
      ok: false,
      error: "OPERADOR_NO_EXISTE",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });

  it("no deja liquidar al rol de soporte", async () => {
    const { roundId } = await roundReadyForManualSettlement();

    expect(await manualSettle(db.pool, await getSupportOperatorId(db.pool), roundId, 4)).toEqual({
      ok: false,
      error: "SIN_PERMISO",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });

  it("no liquida una ronda que no está cerrada para votación", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 2);

    expect(await manualSettle(db.pool, operatorId, roundId, 4)).toEqual({
      ok: false,
      error: "RONDA_NO_DISPONIBLE",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("PROGRAMADA");
  });
});
