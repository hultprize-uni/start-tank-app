import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ROUTES } from "@/shared/lib/api-routes";
import type { OperatorActionView, OperatorViewModel } from "../types";
import {
  executeOperatorAction,
  readOperatorState,
  loginOperator,
} from "./client";

/** Construye una respuesta JSON con el estado HTTP indicado. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Lista de acciones de la ronda con el estado indicado para cada acción. */
function actions(options: {
  reveal: Pick<OperatorActionView, "enabled" | "blockedReason">;
  lastCallEnabled: boolean;
  closeEnabled: boolean;
}): OperatorActionView[] {
  return [
    { id: "open", label: "Abrir mercado", done: true, enabled: false, blockedReason: null },
    {
      id: "last_call",
      label: "Última llamada",
      done: false,
      enabled: options.lastCallEnabled,
      blockedReason: null,
    },
    {
      id: "close",
      label: "Cerrar mercado",
      done: false,
      enabled: options.closeEnabled,
      blockedReason: null,
    },
    { id: "reveal", label: "Revelar veredicto", done: false, ...options.reveal },
    {
      id: "next",
      label: "Siguiente startup",
      done: false,
      enabled: false,
      blockedReason: "Avanza al abrir la siguiente ronda.",
    },
  ];
}

/** Vista del operador para pruebas, con la ronda en votación y el estado de acciones indicado. */
function view(options: {
  reveal: Pick<OperatorActionView, "enabled" | "blockedReason">;
  canCancel?: boolean;
  state?: OperatorViewModel["round"]["status"];
  lastCallEnabled?: boolean;
  closeEnabled?: boolean;
}): OperatorViewModel {
  return {
    round: {
      number: 2,
      total: 5,
      startupName: "Solar Nodo",
      status: options.state ?? "VOTING",
      multiplier: null,
      cancelMode: null,
    },
    rounds: [],
    actions: actions({
      reveal: options.reveal,
      lastCallEnabled: options.lastCallEnabled ?? false,
      closeEnabled: options.closeEnabled ?? false,
    }),
    jurors: [],
    market: {
      accumulated: 0,
      uniqueInvestors: 0,
      connectedAttendees: 0,
      price: 100,
      lastCallRemaining: null,
    },
    standings: [],
    log: [],
    canUndo: false,
    canCancel: options.canCancel ?? true,
    canManualSettle: false,
    manualMode: { enabled: false, backs: 0 },
    balances: [],
    positions: [],
  };
}

/** Cuerpos de las llamadas a la ruta de acciones, en orden. */
function sentActions(fetchMock: ReturnType<typeof vi.fn>): unknown[] {
  return fetchMock.mock.calls
    .filter((lastCall) => String(lastCall[0]) === API_ROUTES.operator.action)
    .map((lastCall) => JSON.parse(String((lastCall[1] as RequestInit).body)).action);
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loginOperator", () => {
  it("devuelve null cuando el código es aceptado", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, name: "op.1" }));

    await expect(loginOperator("CODIGO-REAL")).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe(API_ROUTES.operator.login);
  });

  it("devuelve el mensaje de error cuando el código es rechazado (401)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INVALID_CODE" }, 401));

    await expect(loginOperator("incorrecto")).resolves.toBe(
      "El código no es válido. Verifica el código de acceso del operador.",
    );
  });
});

describe("readOperatorState", () => {
  it("marca la sesión como vencida ante un 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INVALID_SESSION" }, 401));

    const result = await readOperatorState();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.sessionExpired).toBe(true);
    }
  });

  it("informa que no hay rondas cuando la API responde 404", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "NO_ROUNDS" }, 404));

    const result = await readOperatorState();

    expect(result).toEqual({
      ok: false,
      sessionExpired: false,
      message: "No hay rondas configuradas para el evento.",
    });
  });
});

describe("executeOperatorAction: reveal", () => {
  it("no envía nada mientras falten votos y devuelve el motivo del servidor", async () => {
    const result = await executeOperatorAction(
      "reveal",
      view({ reveal: { enabled: false, blockedReason: "Faltan 2 voto(s)" } }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, sessionExpired: false, message: "Faltan 2 voto(s)" });
  });

  it("envía REVEAL cuando los cuatro votos están emitidos", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, state: "SETTLED" }));

    const result = await executeOperatorAction(
      "reveal",
      view({ reveal: { enabled: true, blockedReason: null } }),
    );

    expect(result.ok).toBe(true);
    expect(sentActions(fetchMock)).toEqual(["REVEAL"]);
  });

  it("no revela cuando el estado de la ronda aún no está cargado", async () => {
    const result = await executeOperatorAction("reveal", null);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});

describe("executeOperatorAction: close and cancel", () => {
  it("habilita la votación después de cerrar el mercado", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true, state: "CLOSED" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, state: "VOTING" }));

    const result = await executeOperatorAction(
      "close",
      view({
        reveal: { enabled: false, blockedReason: null },
        state: "OPEN",
        closeEnabled: true,
      }),
    );

    expect(result.ok).toBe(true);
    expect(sentActions(fetchMock)).toEqual(["CLOSE", "ENABLE_VOTING"]);
  });

  it("envía la variante de anulación elegida por el operador", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, state: "CANCELLED" }));

    await executeOperatorAction(
      "cancel_settle_1x",
      view({ reveal: { enabled: false, blockedReason: null } }),
    );

    expect(sentActions(fetchMock)).toEqual(["CANCEL_SETTLE_1X"]);
  });

  it("traduce una transición rechazada por el servidor (409)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "TRANSITION_NOT_ALLOWED" }, 409));

    const result = await executeOperatorAction(
      "last_call",
      view({ reveal: { enabled: false, blockedReason: null }, lastCallEnabled: true }),
    );

    expect(result).toEqual({
      ok: false,
      sessionExpired: false,
      message: "La acción no está permitida en el estado actual de la ronda.",
    });
  });

  it("marca la sesión como vencida cuando una acción llega sin sesión (401)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INVALID_SESSION" }, 401));

    const result = await executeOperatorAction(
      "close",
      view({
        reveal: { enabled: false, blockedReason: null },
        state: "OPEN",
        closeEnabled: true,
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.sessionExpired).toBe(true);
    }
  });
});
