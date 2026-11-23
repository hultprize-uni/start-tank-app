/**
 * Pruebas de integración de fn_accion_operador v2: transiciones, cronómetros de fase, pausa,
 * rol del operador, regla de una sola ronda activa y cierre automático de la última llamada.
 */
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { registerTestDatabase } from "./helpers/database";
import {
  closeForVoting,
  getOperatorId,
  getRoundId,
  getRoundState,
  getRoundTimer,
  getSecondsToPhaseEnd,
  getSupportOperatorId,
  openRound,
  openRoundNumber,
  operatorAction,
  setPhaseEnd,
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
  "PAUSAR",
  "MAS_UN_MINUTO",
  "ANULAR_DEVOLVER",
  "ANULAR_LIQUIDAR_1X",
];

/** Acciones válidas por estado de origen. REANUDAR depende de la pausa, no del estado. */
const ALLOWED: Record<string, State[]> = {
  ABRIR: ["PROGRAMADA"],
  ULTIMA_LLAMADA: ["ABIERTA"],
  CERRAR: ["ABIERTA", "ULTIMA_LLAMADA"],
  HABILITAR_VOTO: ["CERRADA"],
  PAUSAR: ["ABIERTA", "ULTIMA_LLAMADA", "EN_VOTACION"],
  MAS_UN_MINUTO: ["ABIERTA", "ULTIMA_LLAMADA", "EN_VOTACION"],
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
  const result = await settleRound(pool, operatorId, roundId, [4, 4, 2, 2]);
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
    expect(rows).toEqual([expect.objectContaining({ id_operador: String(operatorId), accion: "ABRIR" })]);
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
      expect(await operatorAction(db.pool, operatorId, roundId, action)).toEqual({ ok: true, estado: state });
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
      if (!ALLOWED[action].includes(state)) {
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

  it("cancels a round from voting", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);
    await driveRoundTo(db.pool, operatorId, roundId, "EN_VOTACION");

    expect(await operatorAction(db.pool, operatorId, roundId, "ANULAR_LIQUIDAR_1X")).toMatchObject({
      ok: true,
      estado: "LIQUIDADA",
    });
  });
});

describe("fn_accion_operador: phase timers", () => {
  it("sets the deadline of each phase from the configuration", async () => {
    const operatorId = await getOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);

    await operatorAction(db.pool, operatorId, roundId, "ABRIR");
    // Pitch de 300 s más toma y dame de 600 s.
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeGreaterThan(895);
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeLessThanOrEqual(900);

    await operatorAction(db.pool, operatorId, roundId, "ULTIMA_LLAMADA");
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeGreaterThan(55);
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeLessThanOrEqual(60);

    await operatorAction(db.pool, operatorId, roundId, "CERRAR");
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeNull();

    await operatorAction(db.pool, operatorId, roundId, "HABILITAR_VOTO");
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeGreaterThan(145);
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeLessThanOrEqual(150);
  });

  it("uses the durations stored in the configuracion table", async () => {
    await db.pool.query("update configuracion set valor = '30' where clave = 'duracion_votacion_s'");
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);

    await closeForVoting(db.pool, operatorId, roundId);

    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeGreaterThan(25);
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeLessThanOrEqual(30);
  });
});

describe("fn_accion_operador: pause", () => {
  it("freezes the remaining time and restores it on resume", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await setPhaseEnd(db.pool, roundId, 120);

    expect(await operatorAction(db.pool, operatorId, roundId, "PAUSAR")).toEqual({
      ok: true,
      estado: "ABIERTA",
    });
    const paused = await getRoundTimer(db.pool, roundId);
    expect(paused.phaseEndsAt).toBeNull();
    expect(paused.pausedSeconds).toBeGreaterThanOrEqual(119);
    expect(paused.pausedSeconds).toBeLessThanOrEqual(120);

    expect(await operatorAction(db.pool, operatorId, roundId, "REANUDAR")).toMatchObject({ ok: true });
    const resumed = await getRoundTimer(db.pool, roundId);
    expect(resumed.pausedSeconds).toBeNull();
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeGreaterThan(115);
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeLessThanOrEqual(120);
  });

  it("does not let the time run while paused", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await setPhaseEnd(db.pool, roundId, 60);
    await operatorAction(db.pool, operatorId, roundId, "PAUSAR");
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await operatorAction(db.pool, operatorId, roundId, "REANUDAR");

    // La pausa guardó entre 59 y 60 segundos; la espera no se descuenta.
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeGreaterThan(58);
  });

  it("rejects pausing twice and resuming a round that is not paused", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);

    expect(await operatorAction(db.pool, operatorId, roundId, "REANUDAR")).toEqual({
      ok: false,
      error: "NO_ESTA_EN_PAUSA",
    });
    await operatorAction(db.pool, operatorId, roundId, "PAUSAR");
    expect(await operatorAction(db.pool, operatorId, roundId, "PAUSAR")).toEqual({
      ok: false,
      error: "YA_EN_PAUSA",
    });
  });

  it("clears the pause when the round moves to the next phase", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await operatorAction(db.pool, operatorId, roundId, "PAUSAR");

    expect(await operatorAction(db.pool, operatorId, roundId, "CERRAR")).toMatchObject({ ok: true });

    expect(await getRoundTimer(db.pool, roundId)).toMatchObject({
      state: "CERRADA",
      phaseEndsAt: null,
      pausedSeconds: null,
    });
  });

  it("adds a minute to a running phase", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await setPhaseEnd(db.pool, roundId, 100);

    await operatorAction(db.pool, operatorId, roundId, "MAS_UN_MINUTO");

    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeGreaterThan(155);
    expect(await getSecondsToPhaseEnd(db.pool, roundId)).toBeLessThanOrEqual(160);
  });

  it("adds a minute to a paused phase", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await setPhaseEnd(db.pool, roundId, 100);
    await operatorAction(db.pool, operatorId, roundId, "PAUSAR");

    await operatorAction(db.pool, operatorId, roundId, "MAS_UN_MINUTO");

    const timer = await getRoundTimer(db.pool, roundId);
    expect(timer.phaseEndsAt).toBeNull();
    expect(timer.pausedSeconds).toBeGreaterThanOrEqual(159);
    expect(timer.pausedSeconds).toBeLessThanOrEqual(160);
  });
});

describe("fn_accion_operador: input validation", () => {
  it("rejects the reveal action, which belongs to fn_revelar_veredicto", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);

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

  it("does not let the support role run any action", async () => {
    const supportId = await getSupportOperatorId(db.pool);
    const roundId = await getRoundId(db.pool, 1);

    expect(await operatorAction(db.pool, supportId, roundId, "ABRIR")).toEqual({
      ok: false,
      error: "SIN_PERMISO",
    });
    expect(await getRoundState(db.pool, roundId)).toBe("PROGRAMADA");
    expect(await countActions(db.pool, roundId)).toBe(0);
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

  it("rejects opening a round while an earlier round is still pending", async () => {
    const operatorId = await getOperatorId(db.pool);
    const second = await getRoundId(db.pool, 2);

    expect(await operatorAction(db.pool, operatorId, second, "ABRIR")).toEqual({
      ok: false,
      error: "RONDA_ANTERIOR_PENDIENTE",
    });
    expect(await getRoundState(db.pool, second)).toBe("PROGRAMADA");
  });

  it("rejects skipping a round even when the previous ones are finished", async () => {
    const operatorId = await getOperatorId(db.pool);
    await driveRoundTo(db.pool, operatorId, await getRoundId(db.pool, 1), "ANULADA");

    // La ronda 2 sigue programada, por lo que la 3 no puede abrirse todavía.
    expect(await operatorAction(db.pool, operatorId, await getRoundId(db.pool, 3), "ABRIR")).toEqual({
      ok: false,
      error: "RONDA_ANTERIOR_PENDIENTE",
    });
  });

  /*
   * fn_accion_operador serializa las acciones con un bloqueo asesor de transacción. Dos aperturas
   * simultáneas de rondas distintas no pueden terminar con dos rondas activas: la segunda espera a
   * que la primera confirme y entonces la ve.
   */
  it("never leaves two rounds active when two openings run concurrently", async () => {
    const operatorId = await getOperatorId(db.pool);
    const first = await getRoundId(db.pool, 1);
    const second = await getRoundId(db.pool, 2);
    // La apertura de la ronda 1 queda sin confirmar mientras se intenta abrir la ronda 2.
    const pending = await db.pool.connect();
    try {
      await pending.query("begin");
      const { rows } = await pending.query<{ resultado: { ok: boolean } }>(
        "select fn_accion_operador($1, $2, 'ABRIR') as resultado",
        [operatorId, first],
      );
      const secondPromise = operatorAction(db.pool, operatorId, second, "ABRIR");
      await new Promise((resolve) => setTimeout(resolve, 300));
      await pending.query("commit");
      const secondOpening = await secondPromise;

      expect(rows[0].resultado).toMatchObject({ ok: true });
      expect(secondOpening).toMatchObject({ ok: false, error: "OTRA_RONDA_ACTIVA" });
    } finally {
      pending.release();
    }
  });
});

describe("fn_cerrar_ultima_llamada_vencida", () => {
  async function closeExpired(): Promise<number> {
    const { rows } = await db.pool.query<{ cerradas: number }>(
      "select fn_cerrar_ultima_llamada_vencida() as cerradas",
    );
    return rows[0].cerradas;
  }

  it("closes a round whose last call has expired", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await operatorAction(db.pool, operatorId, roundId, "ULTIMA_LLAMADA");
    await setPhaseEnd(db.pool, roundId, -5);

    expect(await closeExpired()).toBe(1);

    expect(await getRoundTimer(db.pool, roundId)).toMatchObject({ state: "CERRADA", phaseEndsAt: null });
    const { rows } = await db.pool.query<{ cerrada_en: Date | null }>(
      "select cerrada_en from ronda where id_ronda = $1",
      [roundId],
    );
    expect(rows[0].cerrada_en).not.toBeNull();
  });

  it("leaves a last call that has not expired", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await operatorAction(db.pool, operatorId, roundId, "ULTIMA_LLAMADA");

    expect(await closeExpired()).toBe(0);
    expect(await getRoundState(db.pool, roundId)).toBe("ULTIMA_LLAMADA");
  });

  it("leaves a paused last call alone", async () => {
    const { operatorId, roundId } = await openRoundNumber(db.pool, 1);
    await operatorAction(db.pool, operatorId, roundId, "ULTIMA_LLAMADA");
    await operatorAction(db.pool, operatorId, roundId, "PAUSAR");

    expect(await closeExpired()).toBe(0);
    expect(await getRoundState(db.pool, roundId)).toBe("ULTIMA_LLAMADA");
  });

  it("ignores rounds in other states", async () => {
    const { roundId } = await openRoundNumber(db.pool, 1);
    await setPhaseEnd(db.pool, roundId, -5);

    expect(await closeExpired()).toBe(0);
    expect(await getRoundState(db.pool, roundId)).toBe("ABIERTA");
  });
});

describe("function privileges", () => {
  it.each([
    "fn_registrar_inversion(bigint, bigint, numeric)",
    "fn_guardar_borrador(bigint, bigint, bigint, integer)",
    "fn_registrar_voto(bigint, bigint, boolean, jsonb)",
    "fn_revelar_veredicto(bigint, bigint, boolean, varchar)",
    "fn_accion_operador(bigint, bigint, varchar, varchar)",
    "fn_liquidar_ronda(bigint, numeric, varchar)",
    "fn_liquidar_manual(bigint, bigint, numeric, varchar)",
    "fn_ajustar_saldo(bigint, bigint, numeric, varchar)",
    "fn_cerrar_ultima_llamada_vencida()",
    "fn_latido_usuario(bigint)",
    "fn_latido_jurado(bigint)",
  ])("does not grant EXECUTE on %s to PUBLIC", async (signature) => {
    const { rows } = await db.pool.query<{ allowed: boolean }>(
      "select has_function_privilege('public', $1::regprocedure, 'EXECUTE') as allowed",
      [signature],
    );
    expect(rows[0].allowed).toBe(false);
  });
});
