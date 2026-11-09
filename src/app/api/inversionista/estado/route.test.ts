import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvestorViewModel } from "@/lib/api/investor.types";

const sesionMock = vi.hoisted(() => vi.fn());
const estadoMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/investor", () => ({ getInvestorSession: sesionMock }));
vi.mock("@/lib/db/investor-queries", () => ({ leerEstadoInversionista: estadoMock }));

import { GET } from "./route";

const vistaEjemplo: InvestorViewModel = {
  phase: "scheduled",
  round: { number: 1, total: 5 },
  startup: { name: "AgroSense", ods: "ODS 2 · Hambre cero", description: "Descripción" },
  wallet: { balance: 10_000, investedInRound: 0, roundCap: 3_000 },
  market: null,
  countdownSeconds: null,
  verdict: null,
  standing: null,
};

beforeEach(() => {
  sesionMock.mockReset();
  estadoMock.mockReset();
});

describe("GET /api/inversionista/estado", () => {
  it("responde 401 sin sesión y no consulta la base", async () => {
    sesionMock.mockResolvedValue(null);

    const respuesta = await GET();

    expect(respuesta.status).toBe(401);
    await expect(respuesta.json()).resolves.toMatchObject({ error: "SIN_SESION" });
    expect(estadoMock).not.toHaveBeenCalled();
  });

  it("devuelve el view model del asistente de la sesión sin caché", async () => {
    sesionMock.mockResolvedValue({ idUsuario: 7, saldo: 10_000, nombre: "Ana" });
    estadoMock.mockResolvedValue(vistaEjemplo);

    const respuesta = await GET();

    expect(estadoMock).toHaveBeenCalledWith(7);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
    await expect(respuesta.json()).resolves.toEqual(vistaEjemplo);
  });
});
