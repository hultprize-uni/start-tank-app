import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OperatorActionView, OperatorViewModel } from "./operator.types";
import {
  ejecutarAccionOperador,
  leerEstadoOperador,
  loginOperador,
} from "./operator";

/** Construye una respuesta JSON con el estado HTTP indicado. */
function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });
}

/** Lista de acciones de la ronda con el estado indicado para cada acción. */
function acciones(opciones: {
  revelar: Pick<OperatorActionView, "enabled" | "blockedReason">;
  llamadaHabilitada: boolean;
  cerrarHabilitado: boolean;
}): OperatorActionView[] {
  return [
    { id: "abrir", label: "Abrir mercado", done: true, enabled: false, blockedReason: null },
    {
      id: "ultima_llamada",
      label: "Última llamada",
      done: false,
      enabled: opciones.llamadaHabilitada,
      blockedReason: null,
    },
    {
      id: "cerrar",
      label: "Cerrar mercado",
      done: false,
      enabled: opciones.cerrarHabilitado,
      blockedReason: null,
    },
    { id: "revelar", label: "Revelar veredicto", done: false, ...opciones.revelar },
    {
      id: "siguiente",
      label: "Siguiente startup",
      done: false,
      enabled: false,
      blockedReason: "Avanza al abrir la siguiente ronda.",
    },
  ];
}

/** Vista del operador para pruebas, con la ronda en votación y el estado de acciones indicado. */
function vista(opciones: {
  revelar: Pick<OperatorActionView, "enabled" | "blockedReason">;
  canCancel?: boolean;
  estado?: OperatorViewModel["round"]["status"];
  llamadaHabilitada?: boolean;
  cerrarHabilitado?: boolean;
}): OperatorViewModel {
  return {
    round: {
      number: 2,
      total: 5,
      startupName: "Solar Nodo",
      status: opciones.estado ?? "EN_VOTACION",
      multiplier: null,
      result: null,
      cancelMode: null,
    },
    screenSynced: true,
    actions: acciones({
      revelar: opciones.revelar,
      llamadaHabilitada: opciones.llamadaHabilitada ?? false,
      cerrarHabilitado: opciones.cerrarHabilitado ?? false,
    }),
    jurors: [],
    market: { accumulated: 0, uniqueInvestors: 0, connectedAttendees: 0, price: 100 },
    log: [],
    canUndo: false,
    canCancel: opciones.canCancel ?? true,
    canManualSettle: false,
    balances: [],
    positions: [],
  };
}

/** Cuerpos de las llamadas a la ruta de acciones, en orden. */
function accionesEnviadas(fetchMock: ReturnType<typeof vi.fn>): unknown[] {
  return fetchMock.mock.calls
    .filter((llamada) => String(llamada[0]) === "/api/operador/accion")
    .map((llamada) => JSON.parse(String((llamada[1] as RequestInit).body)).accion);
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loginOperador", () => {
  it("devuelve null cuando el código es aceptado", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ ok: true, nombre: "op.1" }));

    await expect(loginOperador("CODIGO-REAL")).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/operador/login");
  });

  it("devuelve el mensaje de error cuando el código es rechazado (401)", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "CODIGO_INVALIDO" }, 401));

    await expect(loginOperador("incorrecto")).resolves.toBe(
      "El código no es válido. Verifica el código de acceso del operador.",
    );
  });
});

describe("leerEstadoOperador", () => {
  it("marca la sesión como vencida ante un 401", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "SESION_NO_VALIDA" }, 401));

    const resultado = await leerEstadoOperador();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.sesionVencida).toBe(true);
    }
  });

  it("informa que no hay rondas cuando la API responde 404", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "SIN_RONDAS" }, 404));

    const resultado = await leerEstadoOperador();

    expect(resultado).toEqual({
      ok: false,
      sesionVencida: false,
      mensaje: "No hay rondas configuradas para el evento.",
    });
  });
});

describe("ejecutarAccionOperador: revelar", () => {
  it("no envía nada mientras falten votos y devuelve el motivo del servidor", async () => {
    const resultado = await ejecutarAccionOperador(
      "revelar",
      vista({ revelar: { enabled: false, blockedReason: "Faltan 2 voto(s)" } }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(resultado).toEqual({ ok: false, sesionVencida: false, mensaje: "Faltan 2 voto(s)" });
  });

  it("envía REVELAR cuando los cuatro votos están emitidos", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ ok: true, estado: "LIQUIDADA" }));

    const resultado = await ejecutarAccionOperador(
      "revelar",
      vista({ revelar: { enabled: true, blockedReason: null } }),
    );

    expect(resultado.ok).toBe(true);
    expect(accionesEnviadas(fetchMock)).toEqual(["REVELAR"]);
  });

  it("no revela cuando el estado de la ronda aún no está cargado", async () => {
    const resultado = await ejecutarAccionOperador("revelar", null);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(resultado.ok).toBe(false);
  });
});

describe("ejecutarAccionOperador: cierre y anulación", () => {
  it("habilita la votación después de cerrar el mercado", async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaJson({ ok: true, estado: "CERRADA" }))
      .mockResolvedValueOnce(respuestaJson({ ok: true, estado: "EN_VOTACION" }));

    const resultado = await ejecutarAccionOperador(
      "cerrar",
      vista({
        revelar: { enabled: false, blockedReason: null },
        estado: "ABIERTA",
        cerrarHabilitado: true,
      }),
    );

    expect(resultado.ok).toBe(true);
    expect(accionesEnviadas(fetchMock)).toEqual(["CERRAR", "HABILITAR_VOTO"]);
  });

  it("envía la variante de anulación elegida por el operador", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ ok: true, estado: "ANULADA" }));

    await ejecutarAccionOperador(
      "anular_liquidar_1x",
      vista({ revelar: { enabled: false, blockedReason: null } }),
    );

    expect(accionesEnviadas(fetchMock)).toEqual(["ANULAR_LIQUIDAR_1X"]);
  });

  it("traduce una transición rechazada por el servidor (409)", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "TRANSICION_NO_PERMITIDA" }, 409));

    const resultado = await ejecutarAccionOperador(
      "ultima_llamada",
      vista({ revelar: { enabled: false, blockedReason: null }, llamadaHabilitada: true }),
    );

    expect(resultado).toEqual({
      ok: false,
      sesionVencida: false,
      mensaje: "La acción no está permitida en el estado actual de la ronda.",
    });
  });

  it("marca la sesión como vencida cuando una acción llega sin sesión (401)", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "SESION_NO_VALIDA" }, 401));

    const resultado = await ejecutarAccionOperador(
      "cerrar",
      vista({
        revelar: { enabled: false, blockedReason: null },
        estado: "ABIERTA",
        cerrarHabilitado: true,
      }),
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.sesionVencida).toBe(true);
    }
  });
});
