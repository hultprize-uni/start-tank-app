import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/server/auth/code-session";
import { DB_OPEN_ROUND_ROW, setupSql } from "@/server/db/test-support";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/server/db/client", () => ({ sql: sqlMock }));

import { handleOperatorAction as POST, handleOperatorManualSettlement } from "./handlers";

/** Configura el almacén de cookies simulado con los pares indicados. */
function setCookies(values: Record<string, string>): void {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name in values ? { name, value: values[name] } : undefined),
  } as never);
}

function request(body: unknown, url = "http://localhost/api/operator/action"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function signInAs(role: "CONDUCTOR" | "SOPORTE", responses: Record<string, unknown[]> = {}) {
  setCookies({ st_operator: await signSession("operator", "1") });
  setupSql(sqlMock, { "from operador": [{ nombre: "Diego", rol: role }], ...responses });
}

beforeEach(() => {
  process.env.SESSION_SECRET = "s".repeat(40);
  sqlMock.mockReset();
  vi.mocked(cookies).mockReset();
});

describe("POST /api/operator/action", () => {
  it("rechaza la petición sin cookie de sesión (RNF-10)", async () => {
    setCookies({});
    const response = await POST(request({ action: "CLOSE" }));

    expect(response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rechaza la acción cuando la sesión pertenece a un jurado (RF-05)", async () => {
    setCookies({ st_operator: await signSession("jury", "2") });

    const response = await POST(request({ action: "CLOSE" }));

    expect(response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rechaza con 403 al soporte sin tocar la ronda (RF-03, RF-05)", async () => {
    await signInAs("SOPORTE");

    const response = await POST(request({ action: "CLOSE" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "FORBIDDEN" });
    const sqlText = sqlMock.mock.calls.map(([s]) => (s as TemplateStringsArray).join("?")).join();
    expect(sqlText).not.toContain("fn_accion_operador");
  });

  it("rechaza acciones que no están en la lista admitida", async () => {
    await signInAs("CONDUCTOR");

    const response = await POST(request({ action: "BORRAR_TODO" }));

    expect(response.status).toBe(400);
  });

  it("exige motivo para anular (RF-10)", async () => {
    await signInAs("CONDUCTOR");

    const response = await POST(request({ action: "CANCEL_REFUND", reason: "  " }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "REASON_REQUIRED" });
  });

  it("informa conflicto cuando no existe ronda sobre la que actuar", async () => {
    await signInAs("CONDUCTOR", { "from ronda r": [] });

    const response = await POST(request({ action: "CLOSE" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "ROUND_UNAVAILABLE" });
  });

  it("pausa la fase del conductor y devuelve el estado", async () => {
    await signInAs("CONDUCTOR", {
      "from ronda r": [{ ...DB_OPEN_ROUND_ROW, estado: "ABIERTA" }],
      fn_accion_operador: [{ resultado: { ok: true, estado: "ABIERTA" } }],
    });

    const response = await POST(request({ action: "PAUSE" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, state: "OPEN", multiplier: null });
  });
});

describe("POST /api/operator/manual-settlement", () => {
  const url = "http://localhost/api/operator/manual-settlement";

  it("valida el puntaje de 1 a 5 y el motivo", async () => {
    await signInAs("CONDUCTOR");

    expect((await handleOperatorManualSettlement(request({ score: 6, reason: "x" }, url))).status).toBe(400);
    const noReason = await handleOperatorManualSettlement(request({ score: 4 }, url));
    expect(noReason.status).toBe(400);
    await expect(noReason.json()).resolves.toEqual({ error: "MOTIVO_REQUERIDO" });
  });

  it("rechaza al soporte", async () => {
    await signInAs("SOPORTE");
    const response = await handleOperatorManualSettlement(request({ score: 4, reason: "x" }, url));
    expect(response.status).toBe(403);
  });
});
