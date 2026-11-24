// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ROUTES } from "@/shared/lib/api-routes";

import { OperatorPortal } from "./OperatorPortal";

vi.mock("@/shared/lib/env", () => ({ USE_MOCKS: false }));

vi.mock("../hooks/useOperatorState", () => ({
  useOperatorState: () => ({
    viewModel: {
      operator: { name: "Diego", role: "CONDUCTOR" },
      round: { number: 1 },
      rounds: [],
      event: { manualMode: false, lastSettledRound: null },
      canRescue: false,
      log: [],
    },
    notice: null,
    clearNotice: vi.fn(),
    lastOkAt: Date.now(),
    run: vi.fn(),
    busy: false,
    refresh: vi.fn(),
    exportCsv: vi.fn(),
  }),
}));

vi.mock("../hooks/useHealth", () => ({
  useHealth: () => ({ health: null, alerts: [] }),
}));

vi.mock("./OperatorConsole", () => ({ OperatorConsole: () => <p>Consola</p> }));

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url === API_ROUTES.operator.logout) return Promise.resolve(jsonResponse({ ok: true }));
    return Promise.resolve(jsonResponse({}));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OperatorPortal: Cerrar sesión", () => {
  it("llama al endpoint de cierre de sesión y vuelve a la pantalla de acceso", async () => {
    render(<OperatorPortal />);
    const salir = await screen.findByRole("button", { name: "Cerrar sesión" });

    await userEvent.click(salir);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument(),
    );
    const logoutCalls = fetchMock.mock.calls.filter(([url]) => url === API_ROUTES.operator.logout);
    expect(logoutCalls).toHaveLength(1);
    expect(logoutCalls[0][1]).toMatchObject({ method: "POST" });
  });

  it("navega entre las secciones del menú", async () => {
    render(<OperatorPortal />);
    const log = await screen.findByRole("button", { name: "Log de acciones" });

    await userEvent.click(log);

    expect(log).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Log de acciones" })).toBeInTheDocument();
  });
});
