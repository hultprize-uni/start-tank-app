import { beforeEach, describe, expect, it, vi } from "vitest";

const sesionMock = vi.hoisted(() => vi.fn());
const registrarMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/investor", () => ({ getInvestorSession: sesionMock }));
vi.mock("@/lib/db/investor-queries", () => ({ registrarInversion: registrarMock }));

import { POST } from "./route";

/** Crea una petición JSON al endpoint de inversión con el cuerpo indicado. */
function peticion(cuerpo: unknown): Request {
  return new Request("http://localhost/api/inversionista/invertir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
}

beforeEach(() => {
  sesionMock.mockReset();
  registrarMock.mockReset();
  sesionMock.mockResolvedValue({ idUsuario: 7, saldo: 10_000, nombre: "Ana" });
});

describe("POST /api/inversionista/invertir", () => {
  it("responde 401 sin sesión y no invoca la función de inversión", async () => {
    sesionMock.mockResolvedValue(null);

    const respuesta = await POST(peticion({ monto: 300 }));

    expect(respuesta.status).toBe(401);
    await expect(respuesta.json()).resolves.toMatchObject({ error: "SIN_SESION" });
    expect(registrarMock).not.toHaveBeenCalled();
  });

  it.each([
    ["ausente", {}],
    ["en texto", { monto: "300" }],
    ["decimal", { monto: 250.5 }],
    ["cero", { monto: 0 }],
    ["negativo", { monto: -250 }],
    ["un cuerpo que no es JSON", "no es json"],
  ])("rechaza el monto con 400 cuando es %s", async (_descripcion, cuerpo) => {
    const respuesta = await POST(peticion(cuerpo));

    expect(respuesta.status).toBe(400);
    await expect(respuesta.json()).resolves.toMatchObject({ error: "MONTO_INVALIDO" });
    expect(registrarMock).not.toHaveBeenCalled();
  });

  it("informa el monto mínimo cuando la función lo rechaza", async () => {
    registrarMock.mockResolvedValue({ ok: false, error: "MONTO_MINIMO", saldo: null });

    const respuesta = await POST(peticion({ monto: 100 }));

    expect(respuesta.status).toBe(422);
    await expect(respuesta.json()).resolves.toEqual({
      error: "MONTO_MINIMO",
      mensaje: "El monto mínimo de compra es 250 coins.",
    });
  });

  it.each([
    ["TOPE_RONDA_SUPERADO", 422],
    ["SALDO_INSUFICIENTE", 422],
    ["RONDA_NO_ABIERTA", 409],
    ["RONDA_NO_EXISTE", 409],
    ["USUARIO_INACTIVO", 403],
    ["USUARIO_NO_EXISTE", 404],
  ])("mapea %s al estado %i con mensaje en español", async (codigo, estado) => {
    registrarMock.mockResolvedValue({ ok: false, error: codigo, saldo: 9_000 });

    const respuesta = await POST(peticion({ monto: 300 }));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(estado);
    expect(cuerpo.error).toBe(codigo);
    expect(typeof cuerpo.mensaje).toBe("string");
    expect(cuerpo.mensaje.length).toBeGreaterThan(0);
  });

  it("usa el identificador de la sesión y descarta cualquier idUsuario del cuerpo (RNF06)", async () => {
    registrarMock.mockResolvedValue({ ok: true, saldo: 9_700 });

    const respuesta = await POST(peticion({ monto: 300, idUsuario: 99 }));

    expect(respuesta.status).toBe(200);
    expect(registrarMock).toHaveBeenCalledWith(7, 300);
    await expect(respuesta.json()).resolves.toEqual({ ok: true, saldo: 9_700 });
  });
});
