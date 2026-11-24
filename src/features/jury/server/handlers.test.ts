import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidSessionError } from "@/server/auth/code-session";

const requireJuryMock = vi.hoisted(() => vi.fn());
const startSessionMock = vi.hoisted(() => vi.fn());
const sqlMock = vi.hoisted(() => vi.fn());
const queriesMock = vi.hoisted(() => ({
  findJurorByCode: vi.fn(),
  readJuryView: vi.fn(),
  registerVote: vi.fn(),
  saveDraftNote: vi.fn(),
}));

vi.mock("@/server/auth/code-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/code-session")>();
  return {
    ...actual,
    requireJury: requireJuryMock,
    startSession: startSessionMock,
  };
});
vi.mock("@/server/db/client", () => ({ sql: sqlMock }));
vi.mock("./queries", () => queriesMock);

import {
  handleJuryDraft,
  handleJuryLogin,
  handleJuryState,
  handleJuryVote,
} from "./handlers";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/jury/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireJuryMock.mockReset();
  startSessionMock.mockReset();
  sqlMock.mockReset();
  queriesMock.findJurorByCode.mockReset();
  queriesMock.readJuryView.mockReset();
  queriesMock.registerVote.mockReset();
  queriesMock.saveDraftNote.mockReset();
});

describe("handleJuryLogin", () => {
  it("devuelve 400 cuando falta el código", async () => {
    const res = await handleJuryLogin(jsonRequest({ code: "  " }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "CODE_REQUIRED" });
  });

  it("devuelve 401 cuando el código no existe", async () => {
    queriesMock.findJurorByCode.mockResolvedValue(null);
    const res = await handleJuryLogin(jsonRequest({ code: "NO-EXISTE" }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "INVALID_CODE" });
  });

  it("inicia la sesión del jurado cuando el código es válido", async () => {
    queriesMock.findJurorByCode.mockResolvedValue({ id: "2", nombre: "Jurado 2" });
    const res = await handleJuryLogin(jsonRequest({ code: "JUR-EJ-002" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, name: "Jurado 2" });
    expect(startSessionMock).toHaveBeenCalledWith(res, "jury", "2");
  });
});

describe("handleJuryState", () => {
  it("devuelve 401 sin sesión de jurado", async () => {
    requireJuryMock.mockRejectedValue(new InvalidSessionError("jury"));
    const res = await handleJuryState();
    expect(res.status).toBe(401);
  });

  it("incluye serverTime en la respuesta y ejecuta el latido", async () => {
    requireJuryMock.mockResolvedValue({ role: "jury", id: "2" });
    queriesMock.readJuryView.mockResolvedValue({ screen: "grading", phase: "open" });
    sqlMock.mockResolvedValue([]);

    const res = await handleJuryState();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { screen: string; serverTime?: string };
    expect(body.screen).toBe("grading");
    expect(typeof body.serverTime).toBe("string");
  });
});

describe("handleJuryDraft", () => {
  it("devuelve 400 si la nota está fuera de 1 a 5", async () => {
    requireJuryMock.mockResolvedValue({ role: "jury", id: "2" });
    const res = await handleJuryDraft(jsonRequest({ criterionId: "1", value: 6 }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "INVALID_NOTE" });
  });

  it("devuelve 409 cuando la función SQL rechaza el borrador", async () => {
    requireJuryMock.mockResolvedValue({ role: "jury", id: "2" });
    queriesMock.saveDraftNote.mockResolvedValue({ ok: false, error: "ALREADY_SUBMITTED" });
    const res = await handleJuryDraft(jsonRequest({ criterionId: "1", value: 4 }));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "ALREADY_SUBMITTED" });
  });

  it("devuelve 200 al guardar el borrador", async () => {
    requireJuryMock.mockResolvedValue({ role: "jury", id: "2" });
    queriesMock.saveDraftNote.mockResolvedValue({ ok: true });
    const res = await handleJuryDraft(jsonRequest({ criterionId: "1", value: 4 }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});

describe("handleJuryVote", () => {
  it("devuelve 400 cuando faltan notas o son inválidas", async () => {
    requireJuryMock.mockResolvedValue({ role: "jury", id: "2" });
    const res = await handleJuryVote(jsonRequest({ abstain: false, notes: [] }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "INVALID_NOTES" });
  });

  it("acepta abstención sin motivo enviado", async () => {
    requireJuryMock.mockResolvedValue({ role: "jury", id: "2" });
    queriesMock.registerVote.mockResolvedValue({ ok: true, score: null });

    const res = await handleJuryVote(jsonRequest({ abstain: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, score: null });
    expect(queriesMock.registerVote).toHaveBeenCalledWith("2", { abstain: true });
  });

  it("acepta las cuatro notas y devuelve el puntaje calculado", async () => {
    requireJuryMock.mockResolvedValue({ role: "jury", id: "2" });
    queriesMock.registerVote.mockResolvedValue({ ok: true, score: 4.25 });

    const notes = [
      { criterionId: "1", value: 5 },
      { criterionId: "2", value: 4 },
      { criterionId: "3", value: 4 },
      { criterionId: "4", value: 4 },
    ];
    const res = await handleJuryVote(jsonRequest({ abstain: false, notes }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, score: 4.25 });
  });

  it("devuelve 409 en un envío duplicado", async () => {
    requireJuryMock.mockResolvedValue({ role: "jury", id: "2" });
    queriesMock.registerVote.mockResolvedValue({ ok: false, error: "DUPLICATE_VOTE" });

    const res = await handleJuryVote(jsonRequest({ abstain: true }));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "DUPLICATE_VOTE" });
  });
});
