import { beforeEach, describe, expect, it, vi } from "vitest";
import { DB_OPEN_ROUND_ROW, executedSql, setupSql } from "@/server/db/test-support";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/client", () => ({ sql: sqlMock }));

import { findJurorByCode, readJuryView, registerVote, saveDraftNote } from "./queries";

const DB_CRITERIA = [
  { id: "1", name: "Problema y mercado", weight: "0.250", anchor_min: "A1", anchor_max: "A5" },
  { id: "2", name: "Modelo de negocio", weight: "0.250", anchor_min: "B1", anchor_max: "B5" },
  { id: "3", name: "Impacto ODS", weight: "0.250", anchor_min: "C1", anchor_max: "C5" },
  { id: "4", name: "Equipo y pitch", weight: "0.250", anchor_min: "D1", anchor_max: "D5" },
];

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

  it("recupera el borrador guardado en la ronda abierta y no consulta notas ajenas", async () => {
    setupSql(sqlMock, {
      "from borrador_nota": [
        { id_criterio: "1", valor: 4 },
        { id_criterio: "4", valor: 5 },
      ],
      "from veredicto v": [],
      "where id_jurado": [{ id: "2", nombre: "Jurado de ejemplo 2" }],
      "from criterio": DB_CRITERIA,
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, estado: "ABIERTA" }],
      "from jurado j": [
        { id_jurado: "1", nombre: "Jurado 1", enviado: false, se_abstiene: false, puntaje: null },
        { id_jurado: "2", nombre: "Jurado 2", enviado: false, se_abstiene: false, puntaje: null },
      ],
      "where r.id_ronda": [{ descripcion: "Monitoreo de cultivos.", logo_url: null }],
      "select count(*)::int as total from jurado": [{ total: 2 }],
    });

    const vm = await readJuryView("2");

    expect(vm).toMatchObject({
      screen: "grading",
      phase: "open",
      draftNotes: { "1": 4, "4": 5 },
      reveal: null,
    });
    expect(executedSql(sqlMock)).not.toContain("from nota_criterio");
  });

  it("muestra el envío propio en votación sin consultar ni exponer notas de otros jurados", async () => {
    setupSql(sqlMock, {
      "from borrador_nota": [],
      "from nota_criterio nc": [
        { id_criterio: "1", valor: 4 },
        { id_criterio: "2", valor: 3 },
      ],
      "from veredicto v": [{ id_ronda: "1", se_abstiene: false, puntaje: "3.500" }],
      "where id_jurado": [{ id: "2", nombre: "Jurado de ejemplo 2" }],
      "from criterio": DB_CRITERIA,
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, estado: "EN_VOTACION" }],
      "from jurado j": [
        { id_jurado: "1", nombre: "Jurado 1", enviado: true, se_abstiene: false, puntaje: "4.750" },
        { id_jurado: "2", nombre: "Jurado 2", enviado: true, se_abstiene: false, puntaje: "3.500" },
      ],
      "where r.id_ronda": [{ descripcion: "Monitoreo de cultivos.", logo_url: null }],
      "select count(*)::int as total from jurado": [{ total: 2 }],
    });

    const vm = await readJuryView("2");

    expect(vm).toMatchObject({
      screen: "vote_registered",
      ownVerdict: { abstained: false, score: 3.5, notes: { "1": 4, "2": 3 } },
      votes: { emitted: 2, total: 2 },
      reveal: null,
    });
    expect(JSON.stringify(vm)).not.toContain("4.75");
  });

  it("publica el veredicto de la ronda liquidada con puntaje, multiplicador y notas de todos", async () => {
    setupSql(sqlMock, {
      "from nota_criterio nc": [
        { id_jurado: "1", id_criterio: "1", valor: 5 },
        { id_jurado: "2", id_criterio: "1", valor: 3 },
      ],
      "from veredicto v": [{ id_ronda: "1", se_abstiene: false, puntaje: "3.500" }],
      "where id_jurado": [{ id: "2", nombre: "Jurado de ejemplo 2" }],
      "from criterio": DB_CRITERIA,
      "from ronda r": [
        { ...DB_OPEN_ROUND_ROW, estado: "LIQUIDADA", multiplicador: "1.400", puntaje_jurado: "4.0000" },
      ],
      "from jurado j": [
        { id_jurado: "1", nombre: "Jurado 1", enviado: true, se_abstiene: false, puntaje: "4.500" },
        { id_jurado: "2", nombre: "Jurado 2", enviado: true, se_abstiene: false, puntaje: "3.500" },
      ],
      "where r.id_ronda": [{ descripcion: null, logo_url: null }],
      "select count(*)::int as total from jurado": [{ total: 2 }],
    });

    const vm = await readJuryView("2");

    expect(vm).toMatchObject({
      screen: "result",
      phase: "result",
      reveal: {
        startupScore: 4,
        multiplier: 1.4,
        jurors: [
          { label: "Jurado 1", isOwn: false, submitted: true, abstained: false, score: 4.5, notes: { "1": 5 } },
          { label: "Jurado 2", isOwn: true, submitted: true, abstained: false, score: 3.5, notes: { "1": 3 } },
        ],
      },
    });
  });
});

describe("saveDraftNote", () => {
  it("rechaza el borrador si no hay ronda calificable", async () => {
    setupSql(sqlMock, { "from ronda": [] });

    await expect(saveDraftNote("2", "1", 4)).resolves.toEqual({
      ok: false,
      error: "ROUND_NOT_GRADABLE",
    });
    expect(executedSql(sqlMock)).not.toContain("fn_guardar_borrador");
  });

  it("invoca fn_guardar_borrador y traduce el resultado", async () => {
    setupSql(sqlMock, {
      "from ronda": [{ id_ronda: "3" }],
      fn_guardar_borrador: [{ resultado: { ok: true } }],
    });

    await expect(saveDraftNote("2", "1", 5)).resolves.toEqual({ ok: true });
  });
});

describe("registerVote", () => {
  it("no llama a fn_registrar_voto cuando la ronda no está en votación", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, estado: "ABIERTA" }],
    });

    await expect(
      registerVote("2", { abstain: false, notes: [{ criterionId: "1", value: 4 }] }),
    ).resolves.toEqual({ ok: false, error: "ROUND_NOT_VOTING" });
    expect(executedSql(sqlMock)).not.toContain("fn_registrar_voto");
  });

  it("envía las notas en jsonb a fn_registrar_voto y devuelve el puntaje", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, id_ronda: "3", estado: "EN_VOTACION" }],
      fn_registrar_voto: [{ resultado: { ok: true, puntaje: 4.25 } }],
    });

    const result = await registerVote("2", {
      abstain: false,
      notes: [
        { criterionId: "1", value: 5 },
        { criterionId: "2", value: 4 },
        { criterionId: "3", value: 4 },
        { criterionId: "4", value: 4 },
      ],
    });

    expect(result).toEqual({ ok: true, score: 4.25 });
    const call = sqlMock.mock.calls.find(([strings]) =>
      (strings as TemplateStringsArray).join("?").includes("fn_registrar_voto"),
    );
    expect(call?.slice(1)).toEqual([
      "2",
      "3",
      false,
      JSON.stringify([
        { id_criterio: 1, valor: 5 },
        { id_criterio: 2, valor: 4 },
        { id_criterio: 3, valor: 4 },
        { id_criterio: 4, valor: 4 },
      ]),
    ]);
  });

  it("envía la abstención y traduce el código de error de la función SQL", async () => {
    setupSql(sqlMock, {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, id_ronda: "3", estado: "EN_VOTACION" }],
      fn_registrar_voto: [{ resultado: { ok: false, error: "VOTO_DUPLICADO" } }],
    });

    await expect(registerVote("2", { abstain: true })).resolves.toEqual({
      ok: false,
      error: "DUPLICATE_VOTE",
      score: null,
    });
  });
});
