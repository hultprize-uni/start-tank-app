import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSession = vi.hoisted(() => vi.fn());
const registerMock = vi.hoisted(() => vi.fn());

vi.mock("./session", () => ({ getParticipantSession: mockSession }));
vi.mock("./queries", () => ({ registerInvestment: registerMock }));

import { handleParticipantInvest as POST } from "./handlers";

/** Crea una petición JSON al endpoint de inversión con el cuerpo indicado. */
function request(body: unknown): Request {
  return new Request("http://localhost/api/participant/invest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  mockSession.mockReset();
  registerMock.mockReset();
  mockSession.mockResolvedValue({ userId: 7, balance: 10_000, name: "Ana" });
});

describe("POST /api/participant/invest", () => {
  it("responde 401 sin sesión y no invoca la función de inversión", async () => {
    mockSession.mockResolvedValue(null);

    const response = await POST(request({ amount: 300 }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "NO_SESSION" });
    expect(registerMock).not.toHaveBeenCalled();
  });

  it.each([
    ["ausente", {}],
    ["en texto", { amount: "300" }],
    ["decimal", { amount: 250.5 }],
    ["cero", { amount: 0 }],
    ["negativo", { amount: -250 }],
    ["un cuerpo que no es JSON", "no es json"],
  ])("rechaza el monto con 400 cuando es %s", async (_description, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "INVALID_AMOUNT" });
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("informa el monto mínimo cuando la función lo rechaza", async () => {
    registerMock.mockResolvedValue({ ok: false, error: "BELOW_MINIMUM", balance: null });

    const response = await POST(request({ amount: 100 }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "BELOW_MINIMUM",
      message: "El monto mínimo es 250 coins.",
    });
  });

  it.each([
    ["ROUND_CAP_EXCEEDED", 422],
    ["INSUFFICIENT_BALANCE", 422],
    ["ROUND_NOT_OPEN", 409],
    ["ROUND_NOT_FOUND", 409],
    ["ALREADY_INVESTED", 409],
    ["USER_NOT_FOUND", 404],
  ])("mapea %s al estado %i con mensaje en español", async (code, state) => {
    registerMock.mockResolvedValue({ ok: false, error: code, balance: 9_000 });

    const response = await POST(request({ amount: 300 }));
    const body = await response.json();

    expect(response.status).toBe(state);
    expect(body.error).toBe(code);
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("usa el identificador de la sesión y descarta cualquier userId del cuerpo (RNF06)", async () => {
    registerMock.mockResolvedValue({ ok: true, balance: 9_700 });

    const response = await POST(request({ amount: 300, userId: 99 }));

    expect(response.status).toBe(200);
    expect(registerMock).toHaveBeenCalledWith(7, 300);
    await expect(response.json()).resolves.toEqual({ ok: true, balance: 9_700 });
  });
});
