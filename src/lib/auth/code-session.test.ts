import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  firmarSesion,
  requireJury,
  requireOperator,
  respuestaSinSesion,
  SesionNoValidaError,
  verificarSesion,
} from "./code-session";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const SECRETO = "s".repeat(40);

/** Configura el almacén de cookies simulado con los pares nombre-valor indicados. */
function configurarCookies(valores: Record<string, string>): void {
  vi.mocked(cookies).mockResolvedValue({
    get: (nombre: string) =>
      nombre in valores ? { name: nombre, value: valores[nombre] } : undefined,
  } as never);
}

describe("code-session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRETO;
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
    vi.clearAllMocks();
  });

  it("verifica un token firmado para el mismo rol y devuelve el identificador", async () => {
    const token = await firmarSesion("jurado", "7");
    await expect(verificarSesion(token, "jurado")).resolves.toBe("7");
  });

  it("rechaza un token emitido para otro rol", async () => {
    const token = await firmarSesion("jurado", "7");
    await expect(verificarSesion(token, "operador")).resolves.toBeNull();
  });

  it("rechaza un token alterado", async () => {
    const token = await firmarSesion("operador", "1");
    const alterado = `${token.slice(0, -2)}xx`;
    await expect(verificarSesion(alterado, "operador")).resolves.toBeNull();
  });

  it("rechaza un token firmado con otra clave", async () => {
    const ajeno = await new SignJWT({ rol: "operador" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("otra-clave-distinta-de-treinta-y-dos"));
    await expect(verificarSesion(ajeno, "operador")).resolves.toBeNull();
  });

  it("rechaza un token expirado", async () => {
    const vencido = await new SignJWT({ rol: "jurado" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("3")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRETO));
    await expect(verificarSesion(vencido, "jurado")).resolves.toBeNull();
  });

  it("lanza un error cuando SESSION_SECRET es demasiado corta", async () => {
    process.env.SESSION_SECRET = "corta";
    await expect(firmarSesion("jurado", "1")).rejects.toThrow(/SESSION_SECRET/);
  });

  it("exige la cookie del rol y lanza SesionNoValidaError sin ella", async () => {
    configurarCookies({});
    await expect(requireJury()).rejects.toBeInstanceOf(SesionNoValidaError);
    await expect(requireOperator()).rejects.toBeInstanceOf(SesionNoValidaError);
  });

  it("no acepta una sesión de jurado como sesión de operador", async () => {
    const tokenJurado = await firmarSesion("jurado", "2");
    configurarCookies({ st_operador: tokenJurado });
    await expect(requireOperator()).rejects.toBeInstanceOf(SesionNoValidaError);
  });

  it("devuelve la sesión del operador cuando el token es válido", async () => {
    const tokenOperador = await firmarSesion("operador", "1");
    configurarCookies({ st_operador: tokenOperador });
    await expect(requireOperator()).resolves.toEqual({ rol: "operador", id: "1" });
  });

  it("traduce SesionNoValidaError en respuesta 401 y deja pasar otros errores", () => {
    const respuesta = respuestaSinSesion(new SesionNoValidaError("operador"));
    expect(respuesta?.status).toBe(401);
    expect(respuestaSinSesion(new Error("otro"))).toBeNull();
  });
});
