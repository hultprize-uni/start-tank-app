// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvestmentResult, WalletInfo } from "../types";
import { InvestForm } from "./InvestForm";

afterEach(cleanup);

const wallet: WalletInfo = { balance: 9_000, investedInRound: 0, roundCap: 2_700, alreadyInvested: false };

function renderForm(onConfirm = vi.fn(async (): Promise<InvestmentResult> => ({ ok: true }))) {
  render(<InvestForm startupName="Nodo Solar" wallet={wallet} onConfirm={onConfirm} />);
  return onConfirm;
}

describe("InvestForm", () => {
  it("ofrece los atajos 250, 25 % y Máx, y la vista previa de 1 a 5", async () => {
    renderForm();

    expect(screen.getByRole("button", { name: "250" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "25%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Máx" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Máx" }));
    const preview = screen.getByRole("group", { name: "Lo que recibirías según el jurado" });
    expect(preview).toHaveTextContent("1 de 5 0.2x540");
    expect(preview).toHaveTextContent("5 de 5 1.8x4,860");
  });

  it("no deja revisar un monto fuera de las reglas", async () => {
    const user = userEvent.setup();
    renderForm();
    const review = screen.getByRole("button", { name: "Revisar inversión" });
    expect(review).toBeDisabled();

    await user.type(screen.getByRole("spinbutton", { name: "Monto a invertir" }), "3000");
    expect(screen.getByText("Tu tope en esta ronda es 2,700.")).toBeInTheDocument();
    expect(review).toBeDisabled();
  });

  it("confirma en dos pasos y permite volver a cambiar el monto", async () => {
    const user = userEvent.setup();
    const onConfirm = renderForm();

    await user.click(screen.getByRole("button", { name: "250" }));
    await user.click(screen.getByRole("button", { name: "Revisar inversión" }));
    expect(screen.getByText(/Es tu única inversión de esta ronda/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cambiar monto" }));
    await user.click(screen.getByRole("button", { name: "Revisar inversión" }));
    await user.click(screen.getByRole("button", { name: "Confirmar inversión" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(250));
  });
});
