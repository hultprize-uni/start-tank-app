import { beforeEach, describe, expect, it, vi } from "vitest";
import { DB_OPEN_ROUND_ROW, executedSql, setupSql } from "@/server/db/test-support";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/client", () => ({ sql: sqlMock }));

import { executeOperatorAction } from "./queries";

beforeEach(() => {
  sqlMock.mockReset();
});

describe("executeOperatorAction", () => {
  it("abre la siguiente ronda programada en lugar de la activa", async () => {
    setupSql(sqlMock, {
      "from ronda r": [
        { ...DB_OPEN_ROUND_ROW, id_ronda: "1", numero: 1, estado: "LIQUIDADA" },
        { ...DB_OPEN_ROUND_ROW, id_ronda: "2", numero: 2, estado: "PROGRAMADA" },
      ],
      fn_accion_operador: [{ resultado: { ok: true, estado: "ABIERTA" } }],
    });

    await expect(executeOperatorAction("1", "OPEN")).resolves.toEqual({
      ok: true,
      state: "OPEN",
    });

    const lastCall = sqlMock.mock.calls.find(([strings]) =>
      (strings as TemplateStringsArray).join("?").includes("fn_accion_operador"),
    );
    expect(lastCall?.slice(1)).toEqual(["1", "2", "ABRIR"]);
  });

  it("llama a fn_revelar_veredicto para la acción REVEAL", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, id_ronda: "4", estado: "EN_VOTACION" }],
      fn_revelar_veredicto: [{ resultado: { ok: true, multiplicador: 1.4 } }],
    });

    await executeOperatorAction("1", "REVEAL");

    expect(executedSql(sqlMock)).toContain("fn_revelar_veredicto");
    expect(executedSql(sqlMock)).not.toContain("fn_accion_operador");
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
