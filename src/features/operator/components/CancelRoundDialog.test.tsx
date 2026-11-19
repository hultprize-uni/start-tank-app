// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CancelRoundDialog } from "./CancelRoundDialog";

afterEach(cleanup);

function renderDialog() {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(
    <CancelRoundDialog
      roundNumber={2}
      startupName="Nodo Solar"
      onClose={onClose}
      onConfirm={onConfirm}
    />,
  );
  return { onClose, onConfirm };
}

describe("CancelRoundDialog", () => {
  it("ofrece los dos modos de anulación en el primer paso", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "¿Anular la ronda 2?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Devolver lo invertido/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Liquidar a 1.0x/ })).toBeInTheDocument();
  });

  it("exige confirmación antes de anular y envía el modo elegido", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Liquidar a 1.0x/ }));

    expect(screen.getByRole("heading", { name: "Confirmar anulación" })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Anular ronda" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("settle_1x");
  });

  it("regresa al primer paso desde la confirmación sin anular", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Devolver lo invertido/ }));
    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(screen.getByRole("button", { name: /Devolver lo invertido/ })).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cierra sin anular con Cancelar y con Escape", async () => {
    const user = userEvent.setup();
    const { onClose, onConfirm } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
