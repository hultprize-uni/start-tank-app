// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_JURY_CRITERIA } from "../criteria";
import { ConfirmSendSheet } from "./ConfirmSendSheet";

afterEach(cleanup);

describe("ConfirmSendSheet", () => {
  it("resume los cuatro criterios, sus notas y el puntaje ponderado", () => {
    render(
      <ConfirmSendSheet
        open
        startupName="AguaClara"
        criteria={DEFAULT_JURY_CRITERIA}
        scores={{ "1": 5, "2": 4, "3": 4, "4": 3 }}
        submitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "¿Confirmas el envío de tus notas?" });
    expect(dialog).toHaveTextContent("Evaluación final para AguaClara");
    expect(dialog).toHaveTextContent("Problema y mercado");
    expect(dialog).toHaveTextContent("5 / 5 · Invertiría hoy");
    expect(dialog).toHaveTextContent("4.0 / 5");
  });

  it("permite volver o confirmar el envío definitivo", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmSendSheet
        open
        startupName="AguaClara"
        criteria={DEFAULT_JURY_CRITERIA}
        scores={{ "1": 4, "2": 4, "3": 4, "4": 4 }}
        submitting={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Volver" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar envío" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("deshabilita Volver mientras se envían las notas", () => {
    render(
      <ConfirmSendSheet
        open
        startupName="AguaClara"
        criteria={DEFAULT_JURY_CRITERIA}
        scores={{ "1": 4, "2": 4, "3": 4, "4": 4 }}
        submitting
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Volver" })).toBeDisabled();
  });
});
