import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  signSession,
  requireJury,
  requireOperator,
  noSessionResponse,
  InvalidSessionError,
  verifySession,
} from "./code-session";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const SECRET = "s".repeat(40);

/** Configura el almacén de cookies simulado con los pares nombre-valor indicados. */
function setCookies(values: Record<string, string>): void {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name in values ? { name, value: values[name] } : undefined,
  } as never);
}

describe("code-session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
    vi.clearAllMocks();
  });

  it.each([
    ["jury", 3],
    ["operator", 4],
  ] as const)("firma la sesión de %s por %i horas", async (role, hours) => {
    const token = await signSession(role, "7");
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as {
      iat: number;
      exp: number;
    };
    expect(payload.exp - payload.iat).toBe(hours * 3600);
  });

  it("verifica un token firmado para el mismo rol y devuelve el identificador", async () => {
    const token = await signSession("jury", "7");
    await expect(verifySession(token, "jury")).resolves.toBe("7");
  });

  it("rechaza un token emitido para otro rol", async () => {
    const token = await signSession("jury", "7");
    await expect(verifySession(token, "operator")).resolves.toBeNull();
  });

  it("rechaza un token alterado", async () => {
    const token = await signSession("operator", "1");
    const tampered = `${token.slice(0, -2)}xx`;
    await expect(verifySession(tampered, "operator")).resolves.toBeNull();
  });

  it("rechaza un token firmado con otra clave", async () => {
    const foreign = await new SignJWT({ role: "operator" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("otra-clave-distinta-de-treinta-y-dos"));
    await expect(verifySession(foreign, "operator")).resolves.toBeNull();
  });

  it("rechaza un token expirado", async () => {
    const expiredToken = await new SignJWT({ role: "jury" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("3")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));
    await expect(verifySession(expiredToken, "jury")).resolves.toBeNull();
  });

  it("lanza un error cuando SESSION_SECRET es demasiado corta", async () => {
    process.env.SESSION_SECRET = "corta";
    await expect(signSession("jury", "1")).rejects.toThrow(/SESSION_SECRET/);
  });

  it("exige la cookie del rol y lanza InvalidSessionError sin ella", async () => {
    setCookies({});
    await expect(requireJury()).rejects.toBeInstanceOf(InvalidSessionError);
    await expect(requireOperator()).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it("no acepta una sesión de jurado como sesión de operador", async () => {
    const jurorToken = await signSession("jury", "2");
    setCookies({ st_operator: jurorToken });
    await expect(requireOperator()).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it("devuelve la sesión del operador cuando el token es válido", async () => {
    const operatorToken = await signSession("operator", "1");
    setCookies({ st_operator: operatorToken });
    await expect(requireOperator()).resolves.toEqual({ role: "operator", id: "1" });
  });

  it("traduce InvalidSessionError en respuesta 401 y deja pasar otros errores", () => {
    const response = noSessionResponse(new InvalidSessionError("operator"));
    expect(response?.status).toBe(401);
    expect(noSessionResponse(new Error("otro"))).toBeNull();
  });
});
