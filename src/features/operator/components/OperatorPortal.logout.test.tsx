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
    viewModel: {},
    notice: null,
    runAction: vi.fn(),
    undo: vi.fn(),
    cancelRound: vi.fn(),
    setManualMode: vi.fn(),
    setManualBacks: vi.fn(),
    simulateJurorVote: vi.fn(),
    exportCsv: vi.fn(),
  }),
}));

vi.mock("./OperatorConsole", () => ({
  OperatorConsole: ({ onLogout }: { onLogout: () => void }) => (
    <button type="button" onClick={onLogout}>
      Salir
    </button>
  ),
}));

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

describe("OperatorPortal: boton Salir", () => {
  it("llama al endpoint de cierre de sesion y vuelve a la pantalla de acceso", async () => {
    render(<OperatorPortal />);
    const salir = await screen.findByRole("button", { name: "Salir" });

    await userEvent.click(salir);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument(),
    );
    const logoutCalls = fetchMock.mock.calls.filter(
      ([url]) => url === API_ROUTES.operator.logout,
    );
    expect(logoutCalls).toHaveLength(1);
    expect(logoutCalls[0][1]).toMatchObject({ method: "POST" });
  });
});
