// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { InvestmentResult, WalletInfo } from "../types";
import { InvestForm } from "./InvestForm";

afterEach(cleanup);

const wallet: WalletInfo = { balance: 9_000, investedInRound: 0, roundCap: 2_700 };

describe("InvestForm", () => {
  it("muestra el campo con atajos y la vista previa del retorno", () => {
    render(<InvestForm wallet={wallet} onConfirm={vi.fn()} />);

    expect(screen.getByRole("spinbutton", { name: "Monto a invertir" })).toBeInTheDocument();
    const shortcuts = screen.getByRole("group", { name: "Atajos de monto" });
    expect(screen.getByRole("button", { name: "Mín 250" })).toBeInTheDocument();
    expect(shortcuts).toContainElement(screen.getByRole("button", { name: "Tope 2,700" }));
    const preview = screen.getByRole("group", { name: "Retorno según el jurado" });
    expect(preview).toHaveTextContent("0 de 4 respaldan · 0.2x");
    expect(preview).toHaveTextContent("4 de 4 respaldan · 1.8x");
  });

  it("deshabilita la confirmación hasta que el monto cumple las reglas", async () => {
    const user = userEvent.setup();
    render(<InvestForm wallet={wallet} onConfirm={vi.fn()} />);
    const confirm = screen.getByRole("button", { name: "Confirmar inversión" });

    expect(confirm).toBeDisabled();

    await user.type(screen.getByRole("spinbutton", { name: "Monto a invertir" }), "100");

    expect(confirm).toBeDisabled();
    expect(screen.getByText("El mínimo es 250 coins.")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Monto a invertir" })).toHaveAttribute("aria-invalid", "true");
  });

  it("asigna el monto del atajo y envía la inversión confirmada", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<(amount: number) => Promise<InvestmentResult>>(async () => ({ ok: true }));
    render(<InvestForm wallet={wallet} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Mín 250" }));
    await user.click(screen.getByRole("button", { name: "Confirmar inversión" }));

    expect(onConfirm).toHaveBeenCalledWith(250);
    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Monto a invertir" })).toHaveValue(null));
  });

  it("conserva el monto cuando el servidor rechaza la inversión", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn<(amount: number) => Promise<InvestmentResult>>(async () => ({
      ok: false,
      message: "El mercado ya cerró.",
    }));
    render(<InvestForm wallet={wallet} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Mín 250" }));
    await user.click(screen.getByRole("button", { name: "Confirmar inversión" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("spinbutton", { name: "Monto a invertir" })).toHaveValue(250);
  });

  it("indica el envío pendiente y bloquea una segunda confirmación", async () => {
    const user = userEvent.setup();
    let resolve: (result: InvestmentResult) => void = () => undefined;
    const onConfirm = vi.fn<(amount: number) => Promise<InvestmentResult>>(
      () => new Promise((done) => (resolve = done)),
    );
    render(<InvestForm wallet={wallet} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Mín 250" }));
    await user.click(screen.getByRole("button", { name: "Confirmar inversión" }));

    const pending = screen.getByRole("button", { name: /Confirmar inversión|Enviando inversión/ });
    expect(pending).toHaveAttribute("aria-busy", "true");
    expect(pending).toBeDisabled();

    resolve({ ok: true });
    await waitFor(() => expect(pending).not.toHaveAttribute("aria-busy"));
  });
});
