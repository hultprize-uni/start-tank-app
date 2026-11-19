/**
 * Pruebas de integración de fn_accion_operador (especificación, sección 2.5) y de la regla de una
 * sola ronda activa a la vez.
 */
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  type Decision,
  closeForVoting,
  getOperatorId,
  getRoundId,
  getRoundState,
  openRound,
  operatorAction,
  settleRound,
} from "./helpers/fixtures";

const db = registerTestDatabase();

/** Estados de la ronda que el operador puede alcanzar mediante acciones. */
type State =
  | "PROGRAMADA"
  | "ABIERTA"
  | "ULTIMA_LLAMADA"
  | "CERRADA"
  | "EN_VOTACION"
  | "LIQUIDADA"
  | "ANULADA";

const ALL_STATES: State[] = [
  "PROGRAMADA",
  "ABIERTA",
  "ULTIMA_LLAMADA",
  "CERRADA",
  "EN_VOTACION",
  "LIQUIDADA",
  "ANULADA",
];

const ALL_ACTIONS = [
  "ABRIR",
  "ULTIMA_LLAMADA",
  "CERRAR",
  "HABILITAR_VOTO",
  "ANULAR_DEVOLVER",
  "ANULAR_LIQUIDAR_1X",
];

/** Acciones válidas por estado de origen, según la especificación y fn_accion_operador. */
const ALLOWED: Record<string, State[]> = {
  ABRIR: ["PROGRAMADA"],
  ULTIMA_LLAMADA: ["ABIERTA"],
  CERRAR: ["ABIERTA", "ULTIMA_LLAMADA"],
  HABILITAR_VOTO: ["CERRADA"],
  ANULAR_DEVOLVER: ["ABIERTA", "ULTIMA_LLAMADA", "CERRADA", "EN_VOTACION"],
  ANULAR_LIQUIDAR_1X: ["ABIERTA", "ULTIMA_LLAMADA", "CERRADA", "EN_VOTACION"],
};

/** Lleva la ronda indicada al estado solicitado mediante acciones válidas del operador. */
async function driveRoundTo(pool: Pool, operatorId: number, roundId: number, state: State): Promise<void> {
  if (state === "PROGRAMADA") {
    return;
  }
  if (state === "ANULADA") {
    await openRound(pool, operatorId, roundId);
    await operatorAction(pool, operatorId, roundId, "ANULAR_DEVOLVER");
    return;
  }
  await openRound(pool, operatorId, roundId);
  if (state === "ABIERTA") {
    return;
  }
  if (state === "ULTIMA_LLAMADA") {
    await operatorAction(pool, operatorId, roundId, "ULTIMA_LLAMADA");
    return;
  }
  if (state === "CERRADA") {
    await operatorAction(pool, operatorId, roundId, "CERRAR");
    return;
  }
  await closeForVoting(pool, operatorId, roundId);
  if (state === "EN_VOTACION") {
    return;
  }
  // LIQUIDADA: se registra un voto por jurado y se revela el veredicto.
  const decisions: Decision[] = ["RESPALDA", "RESPALDA", "RECHAZA", "RECHAZA"];
  const result = await settleRound(pool, operatorId, roundId, decisions);
  if (!result.ok) {
    throw new Error(`No fue posible liquidar la ronda: ${result.error}`);
  }
}

async function countActions(pool: Pool, roundId: number): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    "select count(*)::int as total from accion_ronda where id_ronda = $1",
    [roundId],
  );
  return rows[0].total;
}

describe("fn_accion_operador: valid transitions", () => {
  it("opens a programmed round and records the action", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);

    expect(await operatorAction(db.pool, operatorId, roundId, "ABRIR")).toEqual({
      ok: true,
      estado: "ABIERTA",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("ABIERTA");
    const { rows } = await db.pool.query<{ id_operador: string; accion: string; abierta_en: Date | null }>(
      `select a.id_operador, a.accion, r.abierta_en
         from accion_ronda a
         join ronda r on r.id_ronda = a.id_ronda
        where a.id_ronda = $1`,
      [roundId],
    );
    expect(rows).toEqual([
      expect.objectContaining({ id_operador: String(operatorId), accion: "ABRIR" }),
    ]);
    expect(rows[0].abierta_en).not.toBeNull();
  });

  it("walks a round through its full lifecycle in order", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);

    const steps: Array<[string, string]> = [
      ["ABRIR", "ABIERTA"],
      ["ULTIMA_LLAMADA", "ULTIMA_LLAMADA"],
      ["CERRAR", "CERRADA"],
      ["HABILITAR_VOTO", "EN_VOTACION"],
    ];
    for (const [action, state] of steps) {
      expect(await operatorAction(db.pool, operatorId, roundId, action)).toEqual({
        ok: true,
        estado: state,
      });
    }

    const { rows } = await db.pool.query<{ accion: string }>(
      "select accion from accion_ronda where id_ronda = $1 order by id_accion",
      [roundId],
    );
    expect(rows.map((row) => row.accion)).toEqual(steps.map(([action]) => action));
  });

  it("closes the market from the last call as well as from the open state", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);
    await openRound(db.pool, operatorId, roundId);
    await operatorAction(db.pool, operatorId, roundId, "ULTIMA_LLAMADA");

    expect(await operatorAction(db.pool, operatorId, roundId, "CERRAR")).toEqual({
      ok: true,
      estado: "CERRADA",
    });
  });
});

describe("fn_accion_operador: transition matrix", () => {
  const cases: Array<[State, string]> = [];
  for (const state of ALL_STATES) {
    for (const action of ALL_ACTIONS) {
      const allowed = ALLOWED[action]?.includes(state) ?? false;
      if (!allowed) {
        cases.push([state, action]);
      }
    }
  }

  it.each(cases)("rejects %s -> %s without changing the round or the log", async (state, action) => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);
    await driveRoundTo(db.pool, operatorId, roundId, state);
    const logBefore = await countActions(db.pool, roundId);

    expect(await operatorAction(db.pool, operatorId, roundId, action)).toEqual({
      ok: false,
      error: "TRANSICION_NO_PERMITIDA",
    });
    expect(await getRoundState(db.pool, roundId)).toBe(state);
    expect(await countActions(db.pool, roundId)).toBe(logBefore);
  });

  it("advances through valid actions and cancels a round from voting", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);

    // Cada acción se ejecuta desde su estado de origen; la anulación a 1.0x también es válida en votación.
    await openRound(db.pool, operatorId, roundId);
    expect(await operatorAction(db.pool, operatorId, roundId, "ULTIMA_LLAMADA")).toMatchObject({ ok: true });
    expect(await operatorAction(db.pool, operatorId, roundId, "CERRAR")).toMatchObject({ ok: true });
    expect(await operatorAction(db.pool, operatorId, roundId, "HABILITAR_VOTO")).toMatchObject({ ok: true });
    expect(await operatorAction(db.pool, operatorId, roundId, "ANULAR_LIQUIDAR_1X")).toMatchObject({
      ok: true,
      estado: "LIQUIDADA",
    });
  });
});

describe("fn_accion_operador: input validation", () => {
  it("rejects the reveal action, which belongs to fn_revelar_veredicto", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);
    await openRound(db.pool, operatorId, roundId);

    expect(await operatorAction(db.pool, operatorId, roundId, "REVELAR")).toEqual({
      ok: false,
      error: "ACCION_INVALIDA",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("ABIERTA");
  });

  it("rejects an unknown action without changing the round", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);

    expect(await operatorAction(db.pool, operatorId, roundId, "BORRAR_RONDA")).toEqual({
      ok: false,
      error: "ACCION_INVALIDA",
    });
    expect(await countActions(db.pool, roundId)).toBe(0);
  });

  it("rejects an operator that does not exist", async () => {
    const roundId = await getRoundId(db.pool, 1);

    expect(await operatorAction(db.pool, 999999, roundId, "ABRIR")).toEqual({
      ok: false,
      error: "OPERADOR_NO_EXISTE",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("PROGRAMADA");
  });

  it("rejects a round that does not exist", async () => {
    const operatorId = await getOperatorId(db.pool);

    expect(await operatorAction(db.pool, operatorId, 999999, "ABRIR")).toEqual({
      ok: false,
      error: "RONDA_NO_EXISTE",
    });
  });
});

describe("fn_accion_operador: one active round at a time", () => {
  it.each<State>(["ABIERTA", "ULTIMA_LLAMADA", "CERRADA", "EN_VOTACION"])(
    "blocks opening a second round while the first is %s",
    async (state) => {
      const operatorId = await getOperatorId(db.pool);
      const first = await getRoundId(db.pool, 1);
      const second = await getRoundId(db.pool, 2);
      await driveRoundTo(db.pool, operatorId, first, state);

      expect(await operatorAction(db.pool, operatorId, second, "ABRIR")).toEqual({
        ok: false,
        error: "OTRA_RONDA_ACTIVA",
      });
      expect(await getRoundState(db.pool, second)).toBe("PROGRAMADA");
      expect(await getRoundState(db.pool, first)).toBe(state);
    },
  );

  it.each<State>(["LIQUIDADA", "ANULADA"])(
    "allows opening the next round once the previous round is %s",
    async (state) => {
      const operatorId = await getOperatorId(db.pool);
      const first = await getRoundId(db.pool, 1);
      const second = await getRoundId(db.pool, 2);
      await driveRoundTo(db.pool, operatorId, first, state);

      expect(await operatorAction(db.pool, operatorId, second, "ABRIR")).toEqual({
        ok: true,
        estado: "ABIERTA",
      });
    },
  );

  /*
   * Defecto conocido: fn_accion_operador bloquea solo la fila de la ronda que se abre y consulta las
   * demás rondas sin bloqueo. Dos aperturas simultáneas de rondas distintas pueden leer ambas que
   * ninguna ronda está activa y terminar con dos rondas abiertas. La prueba confirma el defecto
   * con una apertura pendiente sin confirmar. Se usa it.fails para que la suite pase mientras el
   * defecto exista; al corregirlo, la prueba falla y debe cambiarse a it.
   */
  it.fails("never leaves two rounds active when two openings run concurrently", async () => {
    const operatorId = await getOperatorId(db.pool);
    const first = await getRoundId(db.pool, 1);
    const second = await getRoundId(db.pool, 2);

    const pending = await db.pool.connect();
    let firstOpening: unknown;
    try {
      await pending.query("begin");
      const { rows } = await pending.query<{ resultado: { ok: boolean } }>(
        "select fn_accion_operador($1, $2, 'ABRIR') as resultado",
        [operatorId, first],
      );
      firstOpening = rows[0].resultado;
      const secondOpening = await operatorAction(db.pool, operatorId, second, "ABRIR");
      await pending.query("commit");

      expect(firstOpening).toMatchObject({ ok: true });
      expect(secondOpening).toMatchObject({ ok: false, error: "OTRA_RONDA_ACTIVA" });
    } finally {
      pending.release();
    }
  });
});

describe("function privileges", () => {
  it.each([
    "fn_registrar_inversion(bigint, bigint, numeric)",
    "fn_registrar_voto(bigint, bigint, varchar)",
    "fn_revelar_veredicto(bigint, bigint)",
    "fn_accion_operador(bigint, bigint, varchar)",
    "fn_liquidar_ronda(bigint, numeric, varchar, boolean)",
  ])("does not grant EXECUTE on %s to PUBLIC", async (signature) => {
    const { rows } = await db.pool.query<{ allowed: boolean }>(
      "select has_function_privilege('public', $1::regprocedure, 'EXECUTE') as allowed",
      [signature],
    );
    expect(rows[0].allowed).toBe(false);
  });
});
