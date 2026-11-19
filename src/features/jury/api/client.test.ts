import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ROUTES } from "@/shared/lib/api-routes";
import { readJuryState, loginJury, voteJury } from "./client";

/** Construye una respuesta JSON con el estado HTTP indicado. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Lee el cuerpo JSON enviado en la llamada indicada de fetch. */
function sentBody(lastCall: unknown[]): unknown {
  const init = lastCall[1] as RequestInit;
  return JSON.parse(String(init.body));
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loginJury", () => {
  it("envía el código a la ruta de acceso del jurado y concede el acceso", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, name: "Jurado 3" }));

    const result = await loginJury("4821");

    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(API_ROUTES.jury.login);
    expect(sentBody(fetchMock.mock.calls[0])).toEqual({ code: "4821" });
  });

  it("informa en español cuando el código es inválido (401)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INVALID_CODE" }, 401));

    const result = await loginJury("0000");

    expect(result).toEqual({
      ok: false,
      sessionExpired: false,
      message: "El código no es válido. Revísalo e inténtalo de nuevo.",
    });
  });

  it("informa error de conexión cuando la petición falla en red", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const result = await loginJury("4821");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/No se pudo conectar/);
    }
  });
});

describe("readJuryState", () => {
  it("devuelve el view model cuando la sesión es válida", async () => {
    const view = {
      screen: "voting",
      access: { status: "idle", errorMessage: null },
      jurorLabel: "Jurado 3",
      round: { number: 2, startupName: "Solar Nodo" },
      criteria: [],
      vote: { draft: null, confirming: false, submitting: false, errorMessage: null },
      votes: { emitted: 1, total: 4 },
    };
    fetchMock.mockResolvedValue(jsonResponse(view));

    const result = await readJuryState();

    expect(fetchMock.mock.calls[0][0]).toBe(API_ROUTES.jury.state);
    expect(result).toEqual({ ok: true, value: view });
  });

  it("marca la sesión como vencida ante un 401 para volver al acceso", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INVALID_SESSION" }, 401));

    const result = await readJuryState();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.sessionExpired).toBe(true);
      expect(result.message).toBe("Tu sesión venció. Ingresa tu código de nuevo.");
    }
  });
});

describe("voteJury", () => {
  it("envía la decisión elegida al endpoint de voto", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    const result = await voteJury("BACK");

    expect(result.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(API_ROUTES.jury.vote);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(sentBody(fetchMock.mock.calls[0])).toEqual({ decision: "BACK" });
  });

  it("traduce el voto duplicado a un mensaje en español", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "DUPLICATE_VOTE" }, 409));

    const result = await voteJury("REJECT");

    expect(result).toEqual({
      ok: false,
      sessionExpired: false,
      message: "Ya registraste tu voto en esta ronda.",
    });
  });

  it("devuelve la sesión vencida cuando el voto llega sin sesión (401)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INVALID_SESSION" }, 401));

    const result = await voteJury("ABSTAIN");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.sessionExpired).toBe(true);
    }
  });

  it("usa el mensaje genérico para un error no contemplado", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "ALGO_RARO" }, 500));

    const result = await voteJury("BACK");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("El servidor no pudo completar la solicitud. Inténtalo de nuevo.");
    }
  });
});
