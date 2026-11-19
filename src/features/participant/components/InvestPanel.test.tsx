// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { WalletInfo } from "../types";
import { InvestPanel } from "./InvestPanel";
import { InvestSheet } from "./InvestSheet";

afterEach(cleanup);

const wallet: WalletInfo = { balance: 9_000, investedInRound: 0, roundCap: 2_700 };

describe("InvestPanel", () => {
  it("se identifica con su título y el nombre de la startup", () => {
    render(<InvestPanel startupName="Nodo Solar" wallet={wallet} onConfirm={vi.fn()} />);

    const panel = screen.getByRole("region", { name: "¿Cuánto inviertes?" });
    expect(panel).toHaveTextContent("en Nodo Solar");
    expect(screen.getByRole("button", { name: "Confirmar inversión" })).toBeInTheDocument();
  });
});

describe("InvestSheet", () => {
  it("muestra un diálogo modal con el formulario cuando está abierta", () => {
    render(
      <InvestSheet
        open
        onClose={vi.fn()}
        startupName="Nodo Solar"
        wallet={wallet}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "¿Cuánto inviertes?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("en Nodo Solar");
    expect(screen.getByRole("spinbutton", { name: "Monto a invertir" })).toBeInTheDocument();
  });

  it("no monta el diálogo ni el formulario cuando está cerrada", () => {
    render(
      <InvestSheet
        open={false}
        onClose={vi.fn()}
        startupName="Nodo Solar"
        wallet={wallet}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("solicita el cierre al pulsar Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <InvestSheet
        open
        onClose={onClose}
        startupName="Nodo Solar"
        wallet={wallet}
        onConfirm={vi.fn()}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
