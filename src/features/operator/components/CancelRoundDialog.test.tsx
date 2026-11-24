// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CancelRoundDialog } from "./CancelRoundDialog";

afterEach(cleanup);

function renderDialog(result: string | null = null) {
  const onClose = vi.fn();
  const onConfirm = vi.fn().mockResolvedValue(result);
  render(
    <CancelRoundDialog roundNumber={2} startupName="AguaClara" onClose={onClose} onConfirm={onConfirm} />,
  );
  return { onClose, onConfirm };
}

describe("CancelRoundDialog (RF-10)", () => {
  it("ofrece los dos modos de anulación en el primer paso", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "¿Anular la ronda 2?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Devolver lo invertido/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Liquidar a 1.0x/ })).toBeInTheDocument();
  });

  it("exige el motivo antes de anular y lo envía con el modo", async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Devolver lo invertido/ }));
    await user.click(screen.getByRole("button", { name: "Anular ronda" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Escribe el motivo para continuar.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Motivo (queda en el log)"), "Falla del proyector");
    await user.click(screen.getByRole("button", { name: "Anular ronda" }));

    expect(onConfirm).toHaveBeenCalledWith("refund", "Falla del proyector");
    expect(onClose).toHaveBeenCalled();
  });

  it("muestra el error del servidor sin cerrar", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog("La acción no está permitida.");

    await user.click(screen.getByRole("button", { name: /Liquidar a 1.0x/ }));
    await user.type(screen.getByLabelText("Motivo (queda en el log)"), "x");
    await user.click(screen.getByRole("button", { name: "Anular ronda" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La acción no está permitida.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("regresa al primer paso y cierra con Escape sin anular", async () => {
    const user = userEvent.setup();
    const { onClose, onConfirm } = renderDialog();

    await user.click(screen.getByRole("button", { name: /Devolver lo invertido/ }));
    await user.click(screen.getByRole("button", { name: "Volver" }));
    expect(screen.getByRole("button", { name: /Devolver lo invertido/ })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
