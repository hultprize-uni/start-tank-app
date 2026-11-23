// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AbstainSheet } from "./AbstainSheet";

afterEach(cleanup);

describe("AbstainSheet", () => {
  it("mantiene deshabilitada la confirmación hasta elegir un motivo", async () => {
    const onConfirm = vi.fn();
    render(
      <AbstainSheet
        open
        startupName="AguaClara"
        submitting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Declarar conflicto de interés" });
    expect(dialog).toHaveTextContent("El motivo no se almacena en el sistema.");

    const confirmButton = within(dialog).getByRole("button", { name: "Confirmar abstención" });
    expect(confirmButton).toBeDisabled();

    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Vínculo familiar o personal con el equipo" }),
    );
    expect(confirmButton).toBeEnabled();

    await userEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith();
  });

  it("permite volver sin abstenerse", async () => {
    const onClose = vi.fn();
    render(
      <AbstainSheet
        open
        startupName="AguaClara"
        submitting={false}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deshabilita Volver y los motivos mientras se envía la abstención", () => {
    render(
      <AbstainSheet
        open
        startupName="AguaClara"
        submitting
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Volver" })).toBeDisabled();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });
});
