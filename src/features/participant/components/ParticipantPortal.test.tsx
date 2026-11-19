// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ParticipantViewModel,
  UseParticipantStateResult,
} from "../types";
import { ParticipantPortal } from "./ParticipantPortal";

const state = vi.hoisted(() => ({
  current: null as UseParticipantStateResult | null,
}));

vi.mock("../hooks/useParticipantState", () => ({
  useParticipantState: () => state.current,
}));

vi.mock("../api/auth-client", () => ({
  authClient: { signIn: { social: vi.fn() }, signOut: vi.fn() },
}));

/** Simula la consulta de escritorio; las demás consultas, incluida la de movimiento, no coinciden. */
function stubViewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(min-width: 820px)" ? desktop : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const startup = { name: "Nodo Solar", sdg: "ODS 7 · Energía asequible", description: "Solar comunitario." };
const sampleRounds = [
  { number: 1, startupName: "Aurora Agro", state: "settled" as const, invested: 500, gain: 200 },
  { number: 2, startupName: "Nodo Solar", state: "current" as const, invested: 0, gain: null },
  { number: 3, startupName: "Aqua Lima", state: "pending" as const, invested: 0, gain: null },
];

/** Vista con la ronda 2 abierta, el asistente con 9,000 coins y una ronda previa. */
function openView(overrides: Partial<ParticipantViewModel> = {}): ParticipantViewModel {
  return {
    phase: "open",
    round: { number: 2, total: 3 },
    startup,
    wallet: { balance: 9_000, investedInRound: 0, roundCap: 2_700 },
    market: { price: 110, priceChange: 10, totalRaised: 2_200, investorCount: 9 },
    countdownSeconds: null,
    verdict: null,
    standing: {
      position: 4,
      previousPosition: 6,
      participants: 74,
      hits: 1,
      hitsTotal: 1,
      topThree: [{ position: 1, name: "Sofía", balance: 12_000, isCurrent: false }],
      me: { position: 4, name: "Tú", balance: 9_000, isCurrent: true },
    },
    rounds: sampleRounds,
    ...overrides,
  };
}

function setState(vm: ParticipantViewModel | null, extra: Partial<UseParticipantStateResult> = {}) {
  state.current = {
    vm,
    status: "ready",
    errorMessage: null,
    actions: { invest: vi.fn(async () => ({ ok: true as const })) },
    ...extra,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ParticipantPortal en el móvil", () => {
  beforeEach(() => stubViewport(false));

  it("muestra el ingreso con el botón de Google cuando no hay sesión", () => {
    setState({ ...openView(), phase: "login", round: null, startup: null, wallet: null, market: null, standing: null, rounds: [] });
    render(<ParticipantPortal />);

    expect(screen.getByRole("heading", { level: 1, name: "El público invierte. El jurado decide." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingresar con mi cuenta" })).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("muestra la cabecera con el saldo y abre la hoja de inversión desde Invertir", async () => {
    const user = userEvent.setup();
    setState(openView());
    render(<ParticipantPortal />);

    expect(screen.getByText("9,000")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Invertir" }));

    expect(screen.getByRole("dialog", { name: "¿Cuánto inviertes?" })).toBeInTheDocument();
  });

  it("confirma la inversión, cierra la hoja y muestra el aviso de confirmación", async () => {
    const user = userEvent.setup();
    setState(openView());
    render(<ParticipantPortal />);

    await user.click(screen.getByRole("button", { name: "Invertir" }));
    await user.click(screen.getByRole("button", { name: "Mín 250" }));
    await user.click(screen.getByRole("button", { name: "Confirmar inversión" }));

    expect(state.current?.actions.invest).toHaveBeenCalledWith(250);
    expect(await screen.findByRole("status")).toHaveTextContent("Inversión confirmada · −250");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("muestra el mensaje de error del servidor cuando la inversión se rechaza", async () => {
    const user = userEvent.setup();
    setState(openView());
    state.current!.actions.invest = vi.fn(async () => ({ ok: false as const, message: "El mercado ya cerró." }));
    render(<ParticipantPortal />);

    await user.click(screen.getByRole("button", { name: "Invertir" }));
    await user.click(screen.getByRole("button", { name: "Mín 250" }));
    await user.click(screen.getByRole("button", { name: "Confirmar inversión" }));

    expect(await screen.findByRole("status")).toHaveTextContent("El mercado ya cerró.");
  });

  it("no muestra la barra lateral de escritorio", () => {
    setState(openView());
    render(<ParticipantPortal />);

    expect(screen.queryByRole("complementary", { name: "Resumen del evento" })).not.toBeInTheDocument();
  });
});

describe("ParticipantPortal en el escritorio", () => {
  beforeEach(() => stubViewport(true));

  it("muestra el riel de rondas y el panel de inversión en línea sin botón Invertir", () => {
    setState(openView());
    render(<ParticipantPortal />);

    const sidebar = screen.getByRole("complementary", { name: "Resumen del evento" });
    expect(within(sidebar).getByText("Rondas")).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "¿Cuánto inviertes?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invertir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirma la inversión desde el panel en línea", async () => {
    const user = userEvent.setup();
    setState(openView());
    render(<ParticipantPortal />);

    await user.click(screen.getByRole("button", { name: "Mín 250" }));
    await user.click(screen.getByRole("button", { name: "Confirmar inversión" }));

    expect(state.current?.actions.invest).toHaveBeenCalledWith(250);
  });
});

describe("ParticipantPortal en los estados de la ronda", () => {
  beforeEach(() => stubViewport(true));

  it("muestra el veredicto anulado con la clasificación y el historial", () => {
    setState(
      openView({
        phase: "result",
        market: null,
        verdict: {
          decisions: ["BACK", "BACK", "REJECT", "REJECT"],
          backs: 2,
          voters: 4,
          multiplier: 1,
          invested: 500,
          payout: 500,
          gain: 0,
          annulment: "refund",
        },
      }),
    );
    render(<ParticipantPortal />);

    expect(screen.getByText("Ronda anulada")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Clasificación parcial" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tus rondas" })).toBeInTheDocument();
    expect(screen.getByText("Esperando ronda 3")).toBeInTheDocument();
  });

  it("muestra el cierre del evento con saldo final y aciertos", () => {
    setState(
      openView({
        phase: "final",
        round: { number: 3, total: 3 },
        market: null,
        wallet: { balance: 12_480, investedInRound: 0, roundCap: 3_000 },
        standing: {
          position: 3,
          previousPosition: 5,
          participants: 74,
          hits: 2,
          hitsTotal: 3,
          topThree: [],
          me: { position: 3, name: "Tú", balance: 12_480, isCurrent: true },
        },
      }),
    );
    render(<ParticipantPortal />);

    expect(screen.getByText("Fin del evento")).toBeInTheDocument();
    // El saldo aparece en la cabecera y en la tarjeta de cierre.
    expect(screen.getAllByText("12,480")).toHaveLength(2);
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
  });

  it("muestra la última llamada con su cuenta regresiva", () => {
    setState(openView({ phase: "lastCall", countdownSeconds: 30 }));
    render(<ParticipantPortal />);

    expect(screen.getByText("Última llamada")).toBeInTheDocument();
    expect(screen.getByLabelText("Tiempo restante de la última llamada")).toHaveTextContent("00:30");
  });

  it("muestra el mercado cerrado con la inversión bloqueada", () => {
    setState(openView({ phase: "voting", market: null }));
    render(<ParticipantPortal />);

    expect(screen.getByRole("heading", { level: 1, name: "El jurado delibera." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invertir · bloqueado" })).toBeDisabled();
  });

  it("muestra la startup programada antes de abrir el mercado", () => {
    setState(openView({ phase: "scheduled", market: null, countdownSeconds: null }));
    render(<ParticipantPortal />);

    expect(screen.getByRole("heading", { level: 1, name: "Nodo Solar" })).toBeInTheDocument();
    expect(screen.getByText("Ronda 2 de 3 · Programada")).toBeInTheDocument();
  });
});

describe("ParticipantPortal en la carga", () => {
  it("indica la carga mientras no hay estado", () => {
    stubViewport(false);
    setState(null);
    render(<ParticipantPortal />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando...");
  });

  it("muestra el aviso cuando la actualización del estado falla", async () => {
    stubViewport(false);
    setState(openView(), { errorMessage: "No fue posible actualizar la ronda. Reintentando." });
    await act(async () => {
      render(<ParticipantPortal />);
    });

    expect(await screen.findByRole("status")).toHaveTextContent("No fue posible actualizar la ronda. Reintentando.");
  });
});
