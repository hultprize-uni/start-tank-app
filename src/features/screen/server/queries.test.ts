import { beforeEach, describe, expect, it, vi } from "vitest";
import { DB_OPEN_ROUND_ROW, executedSql, setupSql } from "@/server/db/test-support";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/client", () => ({ sql: sqlMock }));

import { readScreen } from "./queries";

beforeEach(() => {
  sqlMock.mockReset();
});

const OPEN_ROUND = {
  ...DB_OPEN_ROUND_ROW,
  fase_termina_en: "2026-11-26T20:10:00.000Z",
  segundos_restantes_pausa: null,
  liquidada_en: null,
  puntaje_jurado: null,
};

/** Respuestas de cada consulta; el orden importa porque gana el primer fragmento que coincide. */
function responses(rounds: unknown[]) {
  return {
    "from configuracion": [{ clave: "modo_manual", valor: "true" }],
    "s.descripcion, s.logo_url": [{ id_ronda: "1", descripcion: "Sensores", logo_url: null }],
    "from ronda r": rounds,
    "count(*)::int as total from usuario": [{ total: 40 }],
    "from jurado j": [],
    "from veredicto": [],
    "from inversion": [{ monto: "4000", creada_en: "2026-11-26T19:58:00.000Z" }],
    "from accion_ronda": [],
    "from usuario": [],
  };
}

describe("readScreen", () => {
  it("returns null when the event has no rounds", async () => {
    setupSql(sqlMock, responses([]));
    await expect(readScreen()).resolves.toBeNull();
  });

  it("builds the open market with the curve, the manual-mode flag and the startup details", async () => {
    setupSql(sqlMock, responses([OPEN_ROUND]));

    const vm = await readScreen(new Date("2026-11-26T20:00:00.000Z"));

    expect(vm).toMatchObject({
      phase: "MARKET",
      manualMode: true,
      startup: { name: "AgroSense", description: "Sensores" },
      market: { accumulated: 4000, price: 120, investors: 18, attendees: 40, points: [{ total: 4000 }] },
    });
  });

  it("only reads, and reads attendees by balance while there is no cut", async () => {
    setupSql(sqlMock, responses([OPEN_ROUND]));

    await readScreen();

    const executed = executedSql(sqlMock);
    expect(executed).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(executed).not.toContain("from leaderboard l");
  });
});
