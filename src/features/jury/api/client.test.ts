import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ROUTES } from "@/shared/lib/api-routes";
import { loginJury, readJuryState, saveJuryDraft, submitJuryVote } from "./client";

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

  it("informa en español cuando el código no existe (401)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INVALID_CODE" }, 401));

    const result = await loginJury("0000");

    expect(result).toEqual({
      ok: false,
      sessionExpired: false,
      message: "Ese código no existe. Revísalo con el equipo organizador e inténtalo de nuevo.",
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
      screen: "grading",
      phase: "voting",
      clock: null,
      access: { status: "idle", errorMessage: null },
      jurorLabel: "Jurado 3",
      round: { id: "2", number: 2, total: 5, startupName: "Solar Nodo", sdg: null, description: null, logoUrl: null },
      rail: [],
      criteria: [],
      draftNotes: {},
      draftStatus: "idle",
      draftError: null,
      vote: { sheet: null, submitting: false, errorMessage: null },
      votes: { emitted: 1, total: 4 },
      ownVerdict: null,
      reveal: null,
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

describe("saveJuryDraft", () => {
  it("envía el criterio y la nota al endpoint de borrador", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    const result = await saveJuryDraft("2", 4);

    expect(result).toEqual({ ok: true, value: null });
    expect(fetchMock.mock.calls[0][0]).toBe(API_ROUTES.jury.draft);
    expect(sentBody(fetchMock.mock.calls[0])).toEqual({ criterionId: "2", value: 4 });
  });

  it("traduce el rechazo cuando ya envió sus notas (409)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "ALREADY_SUBMITTED" }, 409));

    const result = await saveJuryDraft("2", 5);

    expect(result).toEqual({
      ok: false,
      sessionExpired: false,
      message: "Ya enviaste tus notas definitivas en esta ronda.",
    });
  });

  it("marca la sesión vencida cuando responde 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INVALID_SESSION" }, 401));

    const result = await saveJuryDraft("1", 3);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.sessionExpired).toBe(true);
    }
  });
});

describe("submitJuryVote", () => {
  it("envía las cuatro notas al endpoint de voto", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, score: 4.25 }));

    const notes = [
      { criterionId: "1", value: 5 as const },
      { criterionId: "2", value: 4 as const },
      { criterionId: "3", value: 4 as const },
      { criterionId: "4", value: 4 as const },
    ];
    const result = await submitJuryVote({ abstain: false, notes });

    expect(result).toEqual({ ok: true, value: { score: 4.25 } });
    expect(fetchMock.mock.calls[0][0]).toBe(API_ROUTES.jury.vote);
    expect(sentBody(fetchMock.mock.calls[0])).toEqual({ abstain: false, notes });
  });

  it("traduce el envío duplicado a un mensaje en español", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "DUPLICATE_VOTE" }, 409));

    const result = await submitJuryVote({ abstain: true });

    expect(result).toEqual({
      ok: false,
      sessionExpired: false,
      message: "Ya registraste tu envío definitivo en esta ronda.",
    });
  });

  it("devuelve la sesión vencida cuando el voto llega sin sesión (401)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INVALID_SESSION" }, 401));

    const result = await submitJuryVote({ abstain: true });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.sessionExpired).toBe(true);
    }
  });

  it("usa el mensaje genérico para un error no contemplado", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "ALGO_RARO" }, 500));

    const result = await submitJuryVote({ abstain: true });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("El servidor no pudo completar la solicitud. Inténtalo de nuevo.");
    }
  });
});
