import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ROUTES } from "@/shared/lib/api-routes";

vi.mock("@/shared/lib/env", () => ({ USE_MOCKS: false }));

import {
  actionBody,
  adjustBalance,
  readOperatorState,
  runOperatorCommand,
  searchAttendees,
} from "./client";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("actionBody", () => {
  it("traduce cada comando a la acción de la API", () => {
    expect(actionBody({ type: "step", id: "last_call" })).toEqual({ action: "LAST_CALL" });
    expect(actionBody({ type: "step", id: "enable_voting" })).toEqual({ action: "ENABLE_VOTING" });
    expect(actionBody({ type: "timer", command: "add_minute" })).toEqual({ action: "ADD_MINUTE" });
    expect(actionBody({ type: "rescue", reason: "Jurado 3 caído" })).toEqual({
      action: "REVEAL",
      reason: "Jurado 3 caído",
    });
    expect(actionBody({ type: "cancel", mode: "settle_1x", reason: "Falla" })).toEqual({
      action: "CANCEL_SETTLE_1X",
      reason: "Falla",
    });
  });
});

describe("runOperatorCommand", () => {
  it("envía la acción y devuelve el multiplicador", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, state: "SETTLED", multiplier: 1.4 }));

    const result = await runOperatorCommand({ type: "rescue", reason: "Jurado 3 caído" });

    expect(result).toEqual({ ok: true, value: { multiplier: 1.4 } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(API_ROUTES.operator.action);
    expect(JSON.parse(String(init.body))).toEqual({ action: "REVEAL", reason: "Jurado 3 caído" });
  });

  it("explica en español el rechazo por rol", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "FORBIDDEN" }, 403));

    const result = await runOperatorCommand({ type: "step", id: "close" });

    expect(result).toMatchObject({ ok: false, sessionExpired: false });
    expect(!result.ok && result.message).toMatch(/soporte/);
  });

  it("marca la sesión vencida con 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INVALID_SESSION" }, 401));
    await expect(readOperatorState()).resolves.toMatchObject({ ok: false, sessionExpired: true });
  });

  it("indica fuera de línea si falla la red", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const result = await runOperatorCommand({ type: "timer", command: "pause" });
    expect(result).toMatchObject({ ok: false, sessionExpired: false });
  });
});

describe("asistentes", () => {
  it("codifica la búsqueda en la URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], online: 0, total: 0 }));
    await searchAttendees("diego p");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_ROUTES.operator.attendees}?q=diego%20p`);
  });

  it("envía el ajuste con su motivo", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, balance: 7500 }));
    const result = await adjustBalance("7", 500, "Error del sistema");
    expect(result).toEqual({ ok: true, value: { balance: 7500 } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      userId: "7",
      amount: 500,
      reason: "Error del sistema",
    });
  });
});
