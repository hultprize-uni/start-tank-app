import { beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({ sql: sqlMock }));

import {
  buscarJuradoPorCodigo,
  ejecutarAccionOperador,
  leerPantalla,
  leerVistaJurado,
  registrarVoto,
} from "./queries";

/** Respuestas simuladas indexadas por un fragmento del texto SQL de cada consulta. */
type Respuestas = Record<string, unknown[]>;

/**
 * Configura el sql mockeado: cada consulta devuelve las filas del primer fragmento que aparece en
 * su texto. Una consulta sin fragmento registrado falla para no ocultar consultas inesperadas.
 */
function configurarBase(respuestas: Respuestas): void {
  sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
    const texto = strings.join("?");
    const clave = Object.keys(respuestas).find((fragmento) => texto.includes(fragmento));
    if (clave === undefined) {
      throw new Error(`Consulta no mockeada: ${texto.trim().slice(0, 80)}`);
    }
    return respuestas[clave];
  });
}

/** Texto de todas las consultas ejecutadas hasta el momento. */
function textoConsultas(): string {
  return sqlMock.mock.calls.map(([strings]) => (strings as TemplateStringsArray).join("?")).join("\n");
}

const FILA_RONDA_ABIERTA = {
  id_ronda: "1",
  numero: 1,
  estado: "ABIERTA",
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
    configurarBase({ "where codigo_acceso": [] });
    await expect(buscarJuradoPorCodigo("INEXISTENTE")).resolves.toBeNull();
  });

  it("devuelve el identificador y el nombre del jurado con ese código", async () => {
    configurarBase({
      "where codigo_acceso": [{ id: "2", nombre: "Jurado de ejemplo 2" }],
    });
    await expect(buscarJuradoPorCodigo("JUR-EJ-002")).resolves.toEqual({
      id: "2",
      nombre: "Jurado de ejemplo 2",
    });
  });
});

describe("leerPantalla", () => {
  it("devuelve nulo cuando el evento no tiene rondas", async () => {
    configurarBase({ "from ronda r": [] });
    await expect(leerPantalla()).resolves.toBeNull();
  });

  it("arma el mercado a partir de las filas de ronda y de startup_leaderboard", async () => {
    configurarBase({
      "from ronda r": [FILA_RONDA_ABIERTA],
      "from jurado j": [],
      "estado = 'ACTIVO'": [{ total: 40 }],
    });

    const vm = await leerPantalla(new Date("2026-11-08T15:00:00.000Z"));

    expect(vm).toMatchObject({
      fase: "MERCADO",
      precio: 120,
      acumulado: 4000,
      inversoresUnicos: 18,
      ronda: { numero: 1, startup: { nombre: "AgroSense", ods: { numero: 2 } } },
    });
  });

  it("no consulta el ranking mientras no existe una ronda terminada", async () => {
    configurarBase({
      "from ronda r": [FILA_RONDA_ABIERTA],
      "from jurado j": [],
      "estado = 'ACTIVO'": [{ total: 40 }],
    });

    await leerPantalla();

    expect(textoConsultas()).not.toContain("from leaderboard l");
  });
});

describe("leerVistaJurado", () => {
  it("devuelve nulo cuando el jurado de la sesión ya no existe", async () => {
    configurarBase({ "where id_jurado": [] });
    await expect(leerVistaJurado("99")).resolves.toBeNull();
  });

  it("muestra el voto registrado del jurado en la ronda en votación", async () => {
    configurarBase({
      "where id_jurado": [{ id: "2", nombre: "Jurado de ejemplo 2" }],
      "from ronda r": [{ ...FILA_RONDA_ABIERTA, estado: "EN_VOTACION" }],
      "from jurado j": [
        { id_jurado: "1", nombre: "Jurado de ejemplo 1", decision: "RESPALDA" },
        { id_jurado: "2", nombre: "Jurado de ejemplo 2", decision: "RECHAZA" },
      ],
      "select count(*)::int as total from jurado": [{ total: 2 }],
    });

    const vm = await leerVistaJurado("2");

    expect(vm).toMatchObject({
      screen: "voto_registrado",
      jurorLabel: "Jurado de ejemplo 2",
      votes: { emitted: 2, total: 2 },
    });
    expect(JSON.stringify(vm)).not.toContain("RESPALDA");
  });
});

describe("registrarVoto", () => {
  it("no llama a fn_registrar_voto cuando no hay ronda activa", async () => {
    configurarBase({
      "from ronda r": [{ ...FILA_RONDA_ABIERTA, estado: "PROGRAMADA" }],
    });

    await expect(registrarVoto("2", "RESPALDA")).resolves.toEqual({
      ok: false,
      error: "RONDA_NO_EN_VOTACION",
    });
    expect(textoConsultas()).not.toContain("fn_registrar_voto");
  });

  it("envía el voto a la ronda activa y devuelve el resultado de la función", async () => {
    configurarBase({
      "from ronda r": [{ ...FILA_RONDA_ABIERTA, id_ronda: "3", estado: "EN_VOTACION" }],
      "fn_registrar_voto": [{ resultado: { ok: true } }],
    });

    await expect(registrarVoto("2", "SE_ABSTIENE")).resolves.toEqual({ ok: true });

    const llamada = sqlMock.mock.calls.find(([strings]) =>
      (strings as TemplateStringsArray).join("?").includes("fn_registrar_voto"),
    );
    expect(llamada?.slice(1)).toEqual(["2", "3", "SE_ABSTIENE"]);
  });
});

describe("ejecutarAccionOperador", () => {
  it("abre la siguiente ronda programada en lugar de la activa", async () => {
    configurarBase({
      "from ronda r": [
        { ...FILA_RONDA_ABIERTA, id_ronda: "1", numero: 1, estado: "LIQUIDADA" },
        { ...FILA_RONDA_ABIERTA, id_ronda: "2", numero: 2, estado: "PROGRAMADA" },
      ],
      "fn_accion_operador": [{ resultado: { ok: true, estado: "ABIERTA" } }],
    });

    await expect(ejecutarAccionOperador("1", "ABRIR")).resolves.toEqual({
      ok: true,
      estado: "ABIERTA",
    });

    const llamada = sqlMock.mock.calls.find(([strings]) =>
      (strings as TemplateStringsArray).join("?").includes("fn_accion_operador"),
    );
    expect(llamada?.slice(1)).toEqual(["1", "2", "ABRIR"]);
  });

  it("llama a fn_revelar_veredicto para la acción REVELAR", async () => {
    configurarBase({
      "from ronda r": [{ ...FILA_RONDA_ABIERTA, id_ronda: "4", estado: "EN_VOTACION" }],
      "fn_revelar_veredicto": [{ resultado: { ok: true, multiplicador: 1.4 } }],
    });

    await ejecutarAccionOperador("1", "REVELAR");

    expect(textoConsultas()).toContain("fn_revelar_veredicto");
    expect(textoConsultas()).not.toContain("fn_accion_operador");
  });

  it("no ejecuta la acción cuando no existe la ronda que le corresponde", async () => {
    configurarBase({
      "from ronda r": [{ ...FILA_RONDA_ABIERTA, estado: "LIQUIDADA" }],
    });

    await expect(ejecutarAccionOperador("1", "CERRAR")).resolves.toEqual({
      ok: false,
      error: "RONDA_NO_DISPONIBLE",
    });
    expect(textoConsultas()).not.toContain("fn_accion_operador");
  });
});
