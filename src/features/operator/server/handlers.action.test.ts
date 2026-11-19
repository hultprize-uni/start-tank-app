import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/server/auth/code-session";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/server/db/client", () => ({ sql: sqlMock }));

import { handleOperatorAction as POST } from "./handlers";

/** Configura el almacén de cookies simulado con los pares indicados. */
function setCookies(values: Record<string, string>): void {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name in values ? { name, value: values[name] } : undefined,
  } as never);
}

function request(action: unknown): Request {
  return new Request("http://localhost/api/operator/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

beforeEach(() => {
  process.env.SESSION_SECRET = "s".repeat(40);
  sqlMock.mockReset();
  vi.mocked(cookies).mockReset();
});

describe("POST /api/operator/action", () => {
  it("rechaza la petición sin cookie de sesión", async () => {
    setCookies({});
    const response = await POST(request("CLOSE"));

    expect(response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rechaza la acción cuando la sesión pertenece a un jurado (RF11)", async () => {
    const jurorToken = await signSession("jury", "2");
    setCookies({ st_operator: jurorToken });

    const response = await POST(request("CLOSE"));

    expect(response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rechaza acciones que no están en la lista admitida", async () => {
    const operatorToken = await signSession("operator", "1");
    setCookies({ st_operator: operatorToken });

    const response = await POST(request("BORRAR_TODO"));

    expect(response.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("informa conflicto cuando no existe ronda sobre la que actuar", async () => {
    const operatorToken = await signSession("operator", "1");
    setCookies({ st_operator: operatorToken });
    sqlMock.mockResolvedValue([]);

    const response = await POST(request("CLOSE"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "ROUND_UNAVAILABLE" });
  });
});
