import { beforeEach, describe, expect, it, vi } from "vitest";
import { DB_OPEN_ROUND_ROW, executedSql, setupSql } from "@/server/db/test-support";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/client", () => ({ sql: sqlMock }));

import { findJurorByCode, readJuryView, registerVote } from "./queries";

beforeEach(() => {
  sqlMock.mockReset();
});

describe("findJurorByCode", () => {
  it("devuelve nulo cuando ningún jurado tiene el código", async () => {
    setupSql(sqlMock, { "where codigo_acceso": [] });
    await expect(findJurorByCode("INEXISTENTE")).resolves.toBeNull();
  });

  it("devuelve el identificador y el nombre del jurado con ese código", async () => {
    setupSql(sqlMock, {
      "where codigo_acceso": [{ id: "2", nombre: "Jurado de ejemplo 2" }],
    });
    await expect(findJurorByCode("JUR-EJ-002")).resolves.toEqual({
      id: "2",
      nombre: "Jurado de ejemplo 2",
    });
  });
});

describe("readJuryView", () => {
  it("devuelve nulo cuando el jurado de la sesión ya no existe", async () => {
    setupSql(sqlMock, { "where id_jurado": [] });
    await expect(readJuryView("99")).resolves.toBeNull();
  });

  it("muestra el voto registrado del jurado en la ronda en votación", async () => {
    setupSql(sqlMock, {
      "where id_jurado": [{ id: "2", nombre: "Jurado de ejemplo 2" }],
      "where r.id_ronda": [{ descripcion: "Monitoreo de cultivos." }],
      "from veredicto v": [{ id_ronda: "1", decision: "RESPALDA" }],
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, estado: "EN_VOTACION" }],
      "from jurado j": [
        { id_jurado: "1", nombre: "Jurado de ejemplo 1", enviado: true, se_abstiene: false, puntaje: "4.000" },
        { id_jurado: "2", nombre: "Jurado de ejemplo 2", enviado: true, se_abstiene: false, puntaje: "2.000" },
      ],
      "select count(*)::int as total from jurado": [{ total: 2 }],
    });

    const vm = await readJuryView("2");

    expect(vm).toMatchObject({
      screen: "vote_registered",
      jurorLabel: "Jurado de ejemplo 2",
      ownVote: "REJECT",
      round: { description: "Monitoreo de cultivos." },
      votes: { emitted: 2, total: 2 },
    });
    expect(JSON.stringify(vm)).not.toContain("BACK");
  });

  it("publica el veredicto de la ronda liquidada con las decisiones de todos los jurados", async () => {
    setupSql(sqlMock, {
      "where id_jurado": [{ id: "2", nombre: "Jurado de ejemplo 2" }],
      "where r.id_ronda": [{ descripcion: null }],
      "from veredicto v": [{ id_ronda: "1", decision: "RESPALDA" }],
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, estado: "LIQUIDADA", multiplicador: "1.20" }],
      "from jurado j": [
        { id_jurado: "1", nombre: "Jurado de ejemplo 1", enviado: true, se_abstiene: false, puntaje: "4.000" },
        { id_jurado: "2", nombre: "Jurado de ejemplo 2", enviado: true, se_abstiene: false, puntaje: "2.000" },
      ],
      "select count(*)::int as total from jurado": [{ total: 2 }],
    });

    const vm = await readJuryView("2");

    expect(vm).toMatchObject({
      screen: "result",
      phase: "result",
      reveal: {
        multiplier: 1.2,
        votes: [
          { label: "Jurado 1", isOwn: false, decision: "BACK" },
          { label: "Jurado 2", isOwn: true, decision: "REJECT" },
        ],
      },
    });
  });
});

describe("registerVote", () => {
  it("no llama a fn_registrar_voto cuando no hay ronda activa", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, estado: "PROGRAMADA" }],
    });

    await expect(registerVote("2", "BACK")).resolves.toEqual({
      ok: false,
      error: "ROUND_NOT_VOTING",
    });
    expect(executedSql(sqlMock)).not.toContain("fn_registrar_voto");
  });

  it("envía el voto a la ronda activa con el valor de la base de datos y devuelve el resultado", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, id_ronda: "3", estado: "EN_VOTACION" }],
      fn_registrar_voto: [{ resultado: { ok: true } }],
    });

    await expect(registerVote("2", "ABSTAIN")).resolves.toEqual({ ok: true });

    const lastCall = sqlMock.mock.calls.find(([strings]) =>
      (strings as TemplateStringsArray).join("?").includes("fn_registrar_voto"),
    );
    expect(lastCall?.slice(1)).toEqual(["2", "3", "SE_ABSTIENE"]);
  });

  it("traduce el código de error de la función SQL", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, id_ronda: "3", estado: "EN_VOTACION" }],
      fn_registrar_voto: [{ resultado: { ok: false, error: "VOTO_DUPLICADO" } }],
    });

    await expect(registerVote("2", "BACK")).resolves.toEqual({ ok: false, error: "DUPLICATE_VOTE" });
  });
});
