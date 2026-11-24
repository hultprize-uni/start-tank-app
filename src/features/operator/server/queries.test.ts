import { beforeEach, describe, expect, it, vi } from "vitest";
import { DB_OPEN_ROUND_ROW, executedSql, setupSql } from "@/server/db/test-support";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/client", () => ({ sql: sqlMock }));

import { executeManualSettlement, executeOperatorAction } from "./queries";

beforeEach(() => {
  sqlMock.mockReset();
});

/** Argumentos de la primera llamada cuyo SQL contiene el fragmento. */
function argsOf(fragment: string): unknown[] | undefined {
  return sqlMock.mock.calls
    .find(([strings]) => (strings as TemplateStringsArray).join("?").includes(fragment))
    ?.slice(1);
}

describe("executeOperatorAction", () => {
  it("abre la siguiente ronda programada en lugar de la activa", async () => {
    setupSql(sqlMock, {
      "from ronda r": [
        { ...DB_OPEN_ROUND_ROW, id_ronda: "1", numero: 1, estado: "LIQUIDADA" },
        { ...DB_OPEN_ROUND_ROW, id_ronda: "2", numero: 2, estado: "PROGRAMADA" },
      ],
      fn_accion_operador: [{ resultado: { ok: true, estado: "ABIERTA" } }],
    });

    await expect(executeOperatorAction("1", "OPEN")).resolves.toEqual({ ok: true, state: "OPEN" });
    expect(argsOf("fn_accion_operador")).toEqual(["1", "2", "ABRIR", null]);
  });

  it("envía pausa, +1 min y el motivo de la anulación a fn_accion_operador", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, id_ronda: "3", estado: "ABIERTA" }],
      fn_accion_operador: [{ resultado: { ok: true } }],
    });

    await executeOperatorAction("1", "PAUSE");
    expect(argsOf("fn_accion_operador")).toEqual(["1", "3", "PAUSAR", null]);

    sqlMock.mockClear();
    await executeOperatorAction("1", "ADD_MINUTE");
    expect(argsOf("fn_accion_operador")).toEqual(["1", "3", "MAS_UN_MINUTO", null]);

    sqlMock.mockClear();
    await executeOperatorAction("1", "CANCEL_REFUND", "Falla del proyector");
    expect(argsOf("fn_accion_operador")).toEqual(["1", "3", "ANULAR_DEVOLVER", "Falla del proyector"]);
  });

  it("revela con los 4 sin motivo y con los presentes cuando hay motivo (RF-18)", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, id_ronda: "4", estado: "EN_VOTACION" }],
      fn_revelar_veredicto: [{ resultado: { ok: true, multiplicador: "1.400" } }],
    });

    await expect(executeOperatorAction("1", "REVEAL")).resolves.toMatchObject({
      ok: true,
      multiplier: 1.4,
    });
    expect(argsOf("fn_revelar_veredicto")).toEqual(["1", "4", false, null]);
    expect(executedSql(sqlMock)).not.toContain("fn_accion_operador");

    sqlMock.mockClear();
    await executeOperatorAction("1", "REVEAL", "Jurado 3 sin conexión");
    expect(argsOf("fn_revelar_veredicto")).toEqual(["1", "4", true, "Jurado 3 sin conexión"]);
  });

  it("traduce el rechazo por rol de soporte", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, estado: "ABIERTA" }],
      fn_accion_operador: [{ resultado: { ok: false, error: "SIN_PERMISO" } }],
    });

    await expect(executeOperatorAction("2", "CLOSE")).resolves.toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });

  it("no ejecuta la acción cuando no existe la ronda que le corresponde", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, estado: "LIQUIDADA" }],
    });

    await expect(executeOperatorAction("1", "CLOSE")).resolves.toEqual({
      ok: false,
      error: "ROUND_UNAVAILABLE",
    });
    expect(executedSql(sqlMock)).not.toContain("fn_accion_operador");
  });
});

describe("executeManualSettlement", () => {
  it("liquida la ronda en curso con el puntaje y el motivo", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, id_ronda: "5", estado: "EN_VOTACION" }],
      fn_liquidar_manual: [{ resultado: { ok: true, multiplicador: 1.4 } }],
    });

    await executeManualSettlement("1", 4, "Falla del portal del jurado");
    expect(argsOf("fn_liquidar_manual")).toEqual(["1", "5", 4, "Falla del portal del jurado"]);
  });
});
