import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { firmarSesion } from "@/lib/auth/code-session";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ sql: sqlMock }));

import { POST } from "./route";

/** Configura el almacén de cookies simulado con los pares indicados. */
function configurarCookies(valores: Record<string, string>): void {
  vi.mocked(cookies).mockResolvedValue({
    get: (nombre: string) =>
      nombre in valores ? { name: nombre, value: valores[nombre] } : undefined,
  } as never);
}

function peticion(accion: unknown): Request {
  return new Request("http://localhost/api/operador/accion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion }),
  });
}

beforeEach(() => {
  process.env.SESSION_SECRET = "s".repeat(40);
  sqlMock.mockReset();
  vi.mocked(cookies).mockReset();
});

describe("POST /api/operador/accion", () => {
  it("rechaza la petición sin cookie de sesión", async () => {
    configurarCookies({});
    const respuesta = await POST(peticion("CERRAR"));

    expect(respuesta.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rechaza la acción cuando la sesión pertenece a un jurado (RF11)", async () => {
    const tokenJurado = await firmarSesion("jurado", "2");
    configurarCookies({ st_operador: tokenJurado });

    const respuesta = await POST(peticion("CERRAR"));

    expect(respuesta.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rechaza acciones que no están en la lista admitida", async () => {
    const tokenOperador = await firmarSesion("operador", "1");
    configurarCookies({ st_operador: tokenOperador });

    const respuesta = await POST(peticion("BORRAR_TODO"));

    expect(respuesta.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("informa conflicto cuando no existe ronda sobre la que actuar", async () => {
    const tokenOperador = await firmarSesion("operador", "1");
    configurarCookies({ st_operador: tokenOperador });
    sqlMock.mockResolvedValue([]);

    const respuesta = await POST(peticion("CERRAR"));

    expect(respuesta.status).toBe(409);
    await expect(respuesta.json()).resolves.toEqual({ error: "RONDA_NO_DISPONIBLE" });
  });
});
