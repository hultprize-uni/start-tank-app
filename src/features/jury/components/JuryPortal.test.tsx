// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { API_ROUTES } from "@/shared/lib/api-routes";
import { DEFAULT_JURY_CRITERIA } from "../criteria";
import type { JuryViewModel } from "../types";
import { JuryPortal } from "./JuryPortal";

const fetchMock = vi.fn();

/** Estado de una sesión vigente en la pantalla de espera, devuelto por la lectura inicial. */
const WAITING_STATE: JuryViewModel = {
  screen: "waiting",
  phase: "scheduled",
  clock: null,
  access: { status: "idle", errorMessage: null },
  jurorLabel: "Jurado 2",
  round: {
    id: "1",
    number: 1,
    total: 2,
    startupName: "AguaClara",
    sdg: "ODS 6",
    description: "Filtros comunitarios de agua.",
    logoUrl: null,
  },
  rail: [{ number: 1, startupName: "AguaClara", status: "current", ownVerdict: null }],
  criteria: DEFAULT_JURY_CRITERIA,
  draftNotes: {},
  draftStatus: "idle",
  draftError: null,
  vote: { sheet: null, submitting: false, errorMessage: null },
  votes: { emitted: 0, total: 4 },
  ownVerdict: null,
  reveal: null,
};

/** Respuesta JSON con el estado HTTP indicado. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Enruta las llamadas simuladas: lectura de estado, cierre de sesión y acceso. */
function routeFetch(logoutResponse: () => Promise<Response>) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === API_ROUTES.jury.state) return Promise.resolve(jsonResponse(WAITING_STATE));
    if (url === API_ROUTES.jury.logout && init?.method === "POST") return logoutResponse();
    return Promise.resolve(jsonResponse({ error: "UNEXPECTED" }, 500));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("JuryPortal: salir de la sesión", () => {
  it("llama al endpoint de salida y vuelve a la pantalla de acceso sin recargar", async () => {
    const user = userEvent.setup();
    routeFetch(() => Promise.resolve(jsonResponse({ ok: true })));
    render(<JuryPortal />);

    const [logoutButton] = await screen.findAllByRole("button", { name: "Salir" });
    expect(logoutButton).toHaveAttribute("type", "button");

    await user.click(logoutButton);

    expect(
      await screen.findByRole("textbox", { name: "Código de acceso" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salir" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      API_ROUTES.jury.logout,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("vuelve al acceso aunque la red falle durante la salida", async () => {
    const user = userEvent.setup();
    routeFetch(() => Promise.reject(new TypeError("fetch failed")));
    render(<JuryPortal />);

    const [logoutButton] = await screen.findAllByRole("button", { name: "Salir" });
    await user.click(logoutButton);

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Código de acceso" })).toBeInTheDocument(),
    );
  });
});
