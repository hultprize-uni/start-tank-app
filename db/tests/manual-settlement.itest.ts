/**
 * Pruebas de integración de la liquidación manual (modo manual del operador). Ejercitan
 * fn_liquidar_manual, que delega en fn_liquidar_ronda sin repetir la lógica de saldos.
 */
import type { Pool } from "pg";
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
  invest,
  openRoundNumber,
} from "./helpers/fixtures";

const db = registerTestDatabase();

interface ManualResult {
  ok: boolean;
  error?: string;
  multiplicador?: number;
  fraccion_respaldo?: number;
}

/** Invoca fn_liquidar_manual con el operador, la ronda y la cantidad de respaldos indicados. */
async function manualSettle(
  pool: Pool,
  operatorId: number,
  roundId: number,
  respaldos: number,
): Promise<ManualResult> {
  const { rows } = await pool.query<{ resultado: ManualResult }>(
    "select fn_liquidar_manual($1, $2, $3) as resultado",
    [operatorId, roundId, respaldos],
  );
  return rows[0].resultado;
}

/** Prepara una ronda con una inversión y la deja en EN_VOTACION, lista para liquidar. */
async function roundReadyForManualSettlement(): Promise<{ operatorId: number; roundId: number; investor: number }> {
  const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
  const investor = await createUser(db.pool);
  await invest(db.pool, investor, roundId, 2000);
  await closeForVoting(db.pool, operatorId, roundId);
  return { operatorId, roundId, investor };
}

describe("manual settlement: liquidación", () => {
  it("liquida con 3 de 4 respaldos y aplica el multiplicador 1.4", async () => {
    const { operatorId, roundId, investor } = await roundReadyForManualSettlement();

    expect(await manualSettle(db.pool, operatorId, roundId, 3)).toMatchObject({
      ok: true,
      multiplicador: 1.4,
      fraccion_respaldo: 0.75,
    });

    expect(await getRoundState(db.pool, roundId)).toBe("LIQUIDADA");
    expect(await getBalance(db.pool, investor)).toBe(10800);
  });

  it("guarda la fracción de respaldo y el puntaje de la startup", async () => {
    const { operatorId, roundId } = await roundReadyForManualSettlement();

    await manualSettle(db.pool, operatorId, roundId, 3);

    const price = await getPriceRow(db.pool, roundId);
    expect(price.fraccionRespaldo).toBe(0.75);
    expect(price.puntaje).not.toBeNull();
  });

  it("registra la acción REVELAR_MANUAL en el registro de la ronda", async () => {
    const { operatorId, roundId } = await roundReadyForManualSettlement();

    await manualSettle(db.pool, operatorId, roundId, 2);

    const { rows } = await db.pool.query<{ accion: string }>(
      "select accion from accion_ronda where id_ronda = $1 order by id_accion desc limit 1",
      [roundId],
    );
    expect(rows[0].accion).toBe("REVELAR_MANUAL");
  });

  it("no liquida una ronda dos veces", async () => {
    const { operatorId, roundId, investor } = await roundReadyForManualSettlement();
    await manualSettle(db.pool, operatorId, roundId, 3);

    expect(await manualSettle(db.pool, operatorId, roundId, 4)).toEqual({
      ok: false,
      error: "RONDA_YA_LIQUIDADA",
    });
    expect(await getBalance(db.pool, investor)).toBe(10800);
  });

  it("rechaza respaldos fuera del rango de 0 a la cantidad de jurados", async () => {
    const { operatorId, roundId } = await roundReadyForManualSettlement();

    expect(await manualSettle(db.pool, operatorId, roundId, 5)).toEqual({
      ok: false,
      error: "RESPALDOS_INVALIDOS",
    });
    expect(await manualSettle(db.pool, operatorId, roundId, -1)).toEqual({
      ok: false,
      error: "RESPALDOS_INVALIDOS",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });

  it("rechaza un operador inexistente", async () => {
    const { roundId } = await roundReadyForManualSettlement();
    const operatorId = await getOperatorId(db.pool);

    expect(await manualSettle(db.pool, operatorId + 999, roundId, 3)).toEqual({
      ok: false,
      error: "OPERADOR_NO_EXISTE",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("EN_VOTACION");
  });

  it("no liquida una ronda que no está cerrada para votación", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 2);

    expect(await manualSettle(db.pool, operatorId, roundId, 3)).toEqual({
      ok: false,
      error: "RONDA_NO_DISPONIBLE",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("PROGRAMADA");
  });
});
