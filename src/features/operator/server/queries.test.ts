import { beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("../../../server/db/client", () => ({ sql: sqlMock }));

import {
  findJurorByCode,
  executeOperatorAction,
  readScreen,
  readJuryView,
  registerVote,
} from "./queries";

/** Respuestas simuladas indexadas por un fragmento del texto SQL de cada consulta. */
type Respuestas = Record<string, unknown[]>;

/**
 * Configura el sql mockeado: cada consulta devuelve las filas del primer fragmento que aparece en
 * su texto. Una consulta sin fragmento registrado falla para no ocultar consultas inesperadas.
 */
function setupBase(respuestas: Respuestas): void {
  sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
    const text = strings.join("?");
    const key = Object.keys(respuestas).find((fragment) => text.includes(fragment));
    if (key === undefined) {
      throw new Error(`Consulta no mockeada: ${text.trim().slice(0, 80)}`);
    }
    return respuestas[key];
  });
}

/** Texto de todas las consultas ejecutadas hasta el momento. */
function queriesText(): string {
  return sqlMock.mock.calls.map(([strings]) => (strings as TemplateStringsArray).join("?")).join("\n");
}

const OPEN_ROUND_ROW = {
  id_ronda: "1",
  numero: 1,
  estado: "OPEN",
  multiplicador: null,
  segundos_ultima_llamada: null,
  startup_nombre: "AgroSense",
  ods: "ODS 2",
  monto_acumulado: "4000",
  inversores_unicos: 18,
  precio_vivo: "120.00",
  fraccion_respaldo: null,
  puntaje: null,
  monto_invertido: "4000",
  retorno_ronda: "0",
};

beforeEach(() => {
  sqlMock.mockReset();
});

describe("buscarJuradoPorCodigo", () => {
  it("devuelve nulo cuando ningún jurado tiene el código", async () => {
    setupBase({ "where codigo_acceso": [] });
    await expect(findJurorByCode("INEXISTENTE")).resolves.toBeNull();
  });

  it("devuelve el identificador y el nombre del jurado con ese código", async () => {
    setupBase({
      "where codigo_acceso": [{ id: "2", nombre: "Jurado de ejemplo 2" }],
    });
    await expect(findJurorByCode("JUR-EJ-002")).resolves.toEqual({
      id: "2",
      nombre: "Jurado de ejemplo 2",
    });
  });
});

describe("leerPantalla", () => {
  it("devuelve nulo cuando el evento no tiene rondas", async () => {
    setupBase({ "from ronda r": [] });
    await expect(readScreen()).resolves.toBeNull();
  });

  it("arma el mercado a partir de las filas de ronda y de startup_leaderboard", async () => {
    setupBase({
      "from ronda r": [OPEN_ROUND_ROW],
      "from jurado j": [],
      "estado = 'ACTIVO'": [{ total: 40 }],
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
    setupBase({
      "from ronda r": [OPEN_ROUND_ROW],
      "from jurado j": [],
      "estado = 'ACTIVO'": [{ total: 40 }],
    });

    await readScreen();

    expect(queriesText()).not.toContain("from leaderboard l");
  });
});

describe("leerVistaJurado", () => {
  it("devuelve nulo cuando el jurado de la sesión ya no existe", async () => {
    setupBase({ "where id_jurado": [] });
    await expect(readJuryView("99")).resolves.toBeNull();
  });

  it("muestra el voto registrado del jurado en la ronda en votación", async () => {
    setupBase({
      "where id_jurado": [{ id: "2", nombre: "Jurado de ejemplo 2" }],
      "from ronda r": [{ ...OPEN_ROUND_ROW, estado: "VOTING" }],
      "from jurado j": [
        { id_jurado: "1", nombre: "Jurado de ejemplo 1", decision: "BACK" },
        { id_jurado: "2", nombre: "Jurado de ejemplo 2", decision: "REJECT" },
      ],
      "select count(*)::int as total from jurado": [{ total: 2 }],
    });

    const vm = await readJuryView("2");

    expect(vm).toMatchObject({
      screen: "vote_registered",
      jurorLabel: "Jurado de ejemplo 2",
      votes: { emitted: 2, total: 2 },
    });
    expect(JSON.stringify(vm)).not.toContain("BACK");
  });
});

describe("registrarVoto", () => {
  it("no llama a fn_registrar_voto cuando no hay ronda activa", async () => {
    setupBase({
      "from ronda r": [{ ...OPEN_ROUND_ROW, estado: "SCHEDULED" }],
    });

    await expect(registerVote("2", "BACK")).resolves.toEqual({
      ok: false,
      error: "ROUND_NOT_VOTING",
    });
    expect(queriesText()).not.toContain("fn_registrar_voto");
  });

  it("envía el voto a la ronda activa y devuelve el resultado de la función", async () => {
    setupBase({
      "from ronda r": [{ ...OPEN_ROUND_ROW, id_ronda: "3", estado: "VOTING" }],
      "fn_registrar_voto": [{ resultado: { ok: true } }],
    });

    await expect(registerVote("2", "ABSTAIN")).resolves.toEqual({ ok: true });

    const lastCall = sqlMock.mock.calls.find(([strings]) =>
      (strings as TemplateStringsArray).join("?").includes("fn_registrar_voto"),
    );
    expect(lastCall?.slice(1)).toEqual(["2", "3", "ABSTAIN"]);
  });
});

describe("ejecutarAccionOperador", () => {
  it("abre la siguiente ronda programada en lugar de la activa", async () => {
    setupBase({
      "from ronda r": [
        { ...OPEN_ROUND_ROW, id_ronda: "1", numero: 1, estado: "SETTLED" },
        { ...OPEN_ROUND_ROW, id_ronda: "2", numero: 2, estado: "SCHEDULED" },
      ],
      "fn_accion_operador": [{ resultado: { ok: true, estado: "OPEN" } }],
    });

    await expect(executeOperatorAction("1", "OPEN")).resolves.toEqual({
      ok: true,
      estado: "OPEN",
    });

    const lastCall = sqlMock.mock.calls.find(([strings]) =>
      (strings as TemplateStringsArray).join("?").includes("fn_accion_operador"),
    );
    expect(lastCall?.slice(1)).toEqual(["1", "2", "OPEN"]);
  });

  it("llama a fn_revelar_veredicto para la acción REVELAR", async () => {
    setupBase({
      "from ronda r": [{ ...OPEN_ROUND_ROW, id_ronda: "4", estado: "VOTING" }],
      "fn_revelar_veredicto": [{ resultado: { ok: true, multiplicador: 1.4 } }],
    });

    await executeOperatorAction("1", "REVEAL");

    expect(queriesText()).toContain("fn_revelar_veredicto");
    expect(queriesText()).not.toContain("fn_accion_operador");
  });

  it("no ejecuta la acción cuando no existe la ronda que le corresponde", async () => {
    setupBase({
      "from ronda r": [{ ...OPEN_ROUND_ROW, estado: "SETTLED" }],
    });

    await expect(executeOperatorAction("1", "CLOSE")).resolves.toEqual({
      ok: false,
      error: "ROUND_UNAVAILABLE",
    });
    expect(queriesText()).not.toContain("fn_accion_operador");
  });
});
