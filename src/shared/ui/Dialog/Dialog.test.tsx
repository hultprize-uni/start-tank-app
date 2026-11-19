// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

afterEach(cleanup);

function DialogHarness({
  onClose = () => {},
  closeOnBackdrop = false,
}: {
  onClose?: () => void;
  closeOnBackdrop?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Dialog
        open={open}
        title="Confirmar inversión"
        description="Esta acción no se puede deshacer."
        closeOnBackdrop={closeOnBackdrop}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <button type="button">Cancelar</button>
        <button type="button">Confirmar</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("no renderiza nada cuando está cerrado", () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Oculto">
        Contenido
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("expone role dialog, aria-modal, nombre y descripción", () => {
    render(
      <Dialog open onClose={() => {}} title="Confirmar" description="Revise el monto">
        Contenido
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Confirmar" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Revise el monto");
  });

  it("mueve el foco al primer elemento enfocable al abrirse", () => {
    render(
      <Dialog open onClose={() => {}} title="Confirmar">
        <button type="button">Primero</button>
        <button type="button">Segundo</button>
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: "Primero" })).toHaveFocus();
  });

  it("cierra con Escape", async () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("atrapa el foco dentro del diálogo al tabular hacia delante y hacia atrás", async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));

    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus();
  });

  it("devuelve el foco al elemento que abrió el diálogo", async () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("cierra al hacer clic en el fondo solo si closeOnBackdrop está activo", async () => {
    const { unmount } = render(<DialogHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const backdrop = document.querySelector("[aria-hidden='true']") as HTMLElement;
    await userEvent.click(backdrop);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    unmount();

    render(<DialogHarness closeOnBackdrop />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const activeBackdrop = document.querySelector("[aria-hidden='true']") as HTMLElement;
    await userEvent.click(activeBackdrop);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("restablece el desplazamiento del cuerpo al cerrarse", () => {
    const { rerender } = render(
      <Dialog open onClose={() => {}} title="Bloqueo">
        Contenido
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Dialog open={false} onClose={() => {}} title="Bloqueo">
        Contenido
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe("");
  });
});
