import { beforeEach, describe, expect, it, vi } from "vitest";
import { DB_OPEN_ROUND_ROW, executedSql, setupSql } from "@/server/db/test-support";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/client", () => ({ sql: sqlMock }));

import { readScreen } from "./queries";

beforeEach(() => {
  sqlMock.mockReset();
});

describe("readScreen", () => {
  it("devuelve nulo cuando el evento no tiene rondas", async () => {
    setupSql(sqlMock, { "from ronda r": [] });
    await expect(readScreen()).resolves.toBeNull();
  });

  it("arma el mercado a partir de las filas de ronda y de startup_leaderboard", async () => {
    setupSql(sqlMock, {
      "from ronda r": [DB_OPEN_ROUND_ROW],
      "from jurado j": [],
      "from usuario": [{ total: 40 }],
    });

    const vm = await readScreen(new Date("2026-11-08T15:00:00.000Z"));

    expect(vm).toMatchObject({
      phase: "MARKET",
      price: 120,
      accumulated: 4000,
      uniqueInvestors: 18,
      round: { number: 1, startup: { name: "AgroSense", sdg: { number: 2 } } },
    });
  });

  it("no consulta el ranking mientras no existe una ronda terminada", async () => {
    setupSql(sqlMock, {
      "from ronda r": [DB_OPEN_ROUND_ROW],
      "from jurado j": [],
      "from usuario": [{ total: 40 }],
    });

    await readScreen();

    expect(executedSql(sqlMock)).not.toContain("from leaderboard l");
  });
});
