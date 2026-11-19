// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenMarket, ScreenViewModel, Waiting } from "../types";
import { ScreenClient } from "./ScreenClient";

/*
 * Pruebas del cliente de la pantalla con la red simulada. El sondeo ocurre cada dos segundos, por
 * lo que las pruebas esperan al menos dos sondeos reales.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ROUND = {
  number: 1,
  startup: { name: "Aqua Viva", sdg: { number: 6, name: "Agua limpia y saneamiento" } },
};

function market(price: number): OpenMarket {
  return {
    phase: "MARKET",
    updatedAt: new Date().toISOString(),
    round: ROUND,
    price,
    accumulated: 5000,
    uniqueInvestors: 12,
  };
}

/** Respuesta JSON nueva en cada llamada, para que el cuerpo se pueda leer una sola vez. */
function jsonResponse(body: ScreenViewModel): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Sustituye fetch por una secuencia de respuestas, una por sondeo. */
function stubSequence(steps: Array<() => Promise<Response>>) {
  const fetchMock = vi.fn(() => {
    const step = steps.shift();
    if (step === undefined) return new Promise<Response>(() => undefined);
    return step();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ScreenClient", () => {
  it("muestra la espera previa cuando el servidor aún no inicia ninguna ronda", async () => {
    const waiting: Waiting = {
      phase: "WAITING",
      updatedAt: new Date().toISOString(),
      nextRound: ROUND,
    };
    stubSequence([async () => jsonResponse(waiting)]);

    render(<ScreenClient showSelector={false} />);

    expect(await screen.findByText("A continuación")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Aqua Viva" })).toBeInTheDocument();
    expect(screen.getByText("Por comenzar")).toBeInTheDocument();
  });

  it(
    "conserva la última lectura cuando cae la red y la actualiza al recuperarla",
    async () => {
      const fetchMock = stubSequence([
        async () => jsonResponse(market(120)),
        async () => {
          throw new TypeError("red no disponible");
        },
        async () => jsonResponse(market(130)),
      ]);

      render(<ScreenClient showSelector={false} />);

      expect(await screen.findByLabelText("Precio 120.0")).toBeInTheDocument();
      expect(await screen.findByRole("status", {}, { timeout: 3_000 })).toHaveTextContent(
        "Sin conexión. Se muestra la última lectura.",
      );
      expect(screen.getByLabelText("Precio 120.0")).toBeInTheDocument();

      expect(await screen.findByLabelText("Precio 130.0", {}, { timeout: 3_000 })).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    },
    10_000,
  );

  it("solo consulta con GET y no envía escrituras", async () => {
    const fetchMock = stubSequence([async () => jsonResponse(market(120))]);

    render(<ScreenClient showSelector={false} />);
    await screen.findByLabelText("Precio 120.0");

    for (const call of fetchMock.mock.calls) {
      const init = (call as unknown[])[1] as RequestInit | undefined;
      expect(init?.method).toBe("GET");
    }
  });

  it("indica la actualización cada dos segundos en el pie", async () => {
    stubSequence([async () => jsonResponse(market(120))]);

    render(<ScreenClient showSelector={false} />);

    expect(await screen.findByText("Actualiza cada 2 segundos")).toBeInTheDocument();
  });
});
