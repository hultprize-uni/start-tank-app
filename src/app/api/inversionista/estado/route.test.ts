import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParticipantViewModel } from "@/features/participant/types";

const mockSession = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => vi.fn());

vi.mock("@/features/participant/server/session", () => ({ getParticipantSession: mockSession }));
vi.mock("@/features/participant/server/queries", () => ({ readParticipantState: mockState }));

import { GET } from "./route";

const sampleView: ParticipantViewModel = {
  phase: "scheduled",
  round: { number: 1, total: 5 },
  startup: { name: "AgroSense", sdg: "ODS 2 · Hambre cero", description: "Descripción" },
  wallet: { balance: 10_000, investedInRound: 0, roundCap: 3_000 },
  market: null,
  countdownSeconds: null,
  verdict: null,
  standing: null,
};

beforeEach(() => {
  mockSession.mockReset();
  mockState.mockReset();
});

describe("GET /api/inversionista/estado", () => {
  it("responde 401 sin sesión y no consulta la base", async () => {
    mockSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "NO_SESSION" });
    expect(mockState).not.toHaveBeenCalled();
  });

  it("devuelve el view model del asistente de la sesión sin caché", async () => {
    mockSession.mockResolvedValue({ userId: 7, balance: 10_000, name: "Ana" });
    mockState.mockResolvedValue(sampleView);

    const response = await GET();

    expect(mockState).toHaveBeenCalledWith(7);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(sampleView);
  });
});
