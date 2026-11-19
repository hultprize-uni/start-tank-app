// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "./BottomSheet";

afterEach(cleanup);

describe("BottomSheet", () => {
  it("se expone como diálogo modal con su título como nombre", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Invertir en Aqua Ruta">
        <button type="button">Confirmar</button>
      </BottomSheet>,
    );
    expect(
      screen.getByRole("dialog", { name: "Invertir en Aqua Ruta" }),
    ).toHaveAttribute("aria-modal", "true");
  });

  it("cierra con Escape como cualquier diálogo", async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Invertir">
        <button type="button">Confirmar</button>
      </BottomSheet>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no muestra el tirador a los lectores de pantalla como contenido", () => {
    const { container } = render(
      <BottomSheet open onClose={() => {}} title="Invertir">
        Contenido
      </BottomSheet>,
    );
    const handle = container.ownerDocument.querySelector("[aria-hidden='true']");
    expect(handle).not.toBeNull();
    expect(handle).toBeEmptyDOMElement();
  });
});
