import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { leerEstadoJurado, loginJurado, votarJurado } from "./jury";

/** Construye una respuesta JSON con el estado HTTP indicado. */
function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });
}

/** Lee el cuerpo JSON enviado en la llamada indicada de fetch. */
function cuerpoEnviado(llamada: unknown[]): unknown {
  const init = llamada[1] as RequestInit;
  return JSON.parse(String(init.body));
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loginJurado", () => {
  it("envía el código a la ruta de acceso del jurado y concede el acceso", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ ok: true, nombre: "Jurado 3" }));

    const resultado = await loginJurado("4821");

    expect(resultado.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/jurado/login");
    expect(cuerpoEnviado(fetchMock.mock.calls[0])).toEqual({ codigo: "4821" });
  });

  it("informa en español cuando el código es inválido (401)", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "CODIGO_INVALIDO" }, 401));

    const resultado = await loginJurado("0000");

    expect(resultado).toEqual({
      ok: false,
      sesionVencida: false,
      mensaje: "El código no es válido. Revísalo e inténtalo de nuevo.",
    });
  });

  it("informa error de conexión cuando la petición falla en red", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const resultado = await loginJurado("4821");

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.mensaje).toMatch(/No se pudo conectar/);
    }
  });
});

describe("leerEstadoJurado", () => {
  it("devuelve el view model cuando la sesión es válida", async () => {
    const vista = {
      screen: "votacion",
      access: { status: "inactivo", errorMessage: null },
      jurorLabel: "Jurado 3",
      round: { number: 2, startupName: "Solar Nodo" },
      criteria: [],
      vote: { draft: null, confirming: false, submitting: false, errorMessage: null },
      votes: { emitted: 1, total: 4 },
    };
    fetchMock.mockResolvedValue(respuestaJson(vista));

    const resultado = await leerEstadoJurado();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/jurado/estado");
    expect(resultado).toEqual({ ok: true, valor: vista });
  });

  it("marca la sesión como vencida ante un 401 para volver al acceso", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "SESION_NO_VALIDA" }, 401));

    const resultado = await leerEstadoJurado();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.sesionVencida).toBe(true);
      expect(resultado.mensaje).toBe("Tu sesión venció. Ingresa tu código de nuevo.");
    }
  });
});

describe("votarJurado", () => {
  it("envía la decisión elegida al endpoint de voto", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ ok: true }));

    const resultado = await votarJurado("RESPALDA");

    expect(resultado.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/jurado/voto");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(cuerpoEnviado(fetchMock.mock.calls[0])).toEqual({ decision: "RESPALDA" });
  });

  it("traduce el voto duplicado a un mensaje en español", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "VOTO_DUPLICADO" }, 409));

    const resultado = await votarJurado("RECHAZA");

    expect(resultado).toEqual({
      ok: false,
      sesionVencida: false,
      mensaje: "Ya registraste tu voto en esta ronda.",
    });
  });

  it("devuelve la sesión vencida cuando el voto llega sin sesión (401)", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "SESION_NO_VALIDA" }, 401));

    const resultado = await votarJurado("SE_ABSTIENE");

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.sesionVencida).toBe(true);
    }
  });

  it("usa el mensaje genérico para un error no contemplado", async () => {
    fetchMock.mockResolvedValue(respuestaJson({ error: "ALGO_RARO" }, 500));

    const resultado = await votarJurado("RESPALDA");

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.mensaje).toBe("El servidor no pudo completar la solicitud. Inténtalo de nuevo.");
    }
  });
});
