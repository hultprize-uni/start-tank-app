// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperatorActionView } from "../types";

import { ActionsPanel } from "./ActionsPanel";

afterEach(cleanup);

/** Acciones de una ronda en votación con el veredicto bloqueado por los votos indicados. */
function votingActions(blockedReason: string | null, enabled: boolean): OperatorActionView[] {
  return [
    { id: "open", label: "Abrir mercado", done: true, enabled: false, blockedReason: null },
    { id: "last_call", label: "Declarar última llamada", done: true, enabled: false, blockedReason: null },
    { id: "close", label: "Cerrar mercado", done: true, enabled: false, blockedReason: null },
    { id: "reveal", label: "Revelar veredicto", done: false, enabled, blockedReason },
    {
      id: "next",
      label: "Siguiente startup",
      done: false,
      enabled: false,
      blockedReason: "Avanza al abrir la siguiente ronda.",
    },
  ];
}

describe("ActionsPanel", () => {
  it("bloquea Revelar y muestra el número de votos que faltan", () => {
    render(
      <ActionsPanel
        actions={votingActions("Bloqueado: faltan 2 votos", false)}
        roundStatus="VOTING"
        onRunAction={() => {}}
      />,
    );

    const revelar = screen.getByRole("button", { name: "Revelar veredicto" });
    expect(revelar).toBeDisabled();
    expect(revelar).toHaveAccessibleDescription("Bloqueado: faltan 2 votos");
    expect(screen.getByText("Bloqueado: faltan 2 votos")).toBeInTheDocument();
  });

  it("usa el singular cuando falta un solo voto", () => {
    render(
      <ActionsPanel
        actions={votingActions("Bloqueado: falta 1 voto", false)}
        roundStatus="VOTING"
        onRunAction={() => {}}
      />,
    );

    expect(screen.getByText("Bloqueado: falta 1 voto")).toBeInTheDocument();
  });

  it("habilita Revelar cuando votaron todos y envía la acción", async () => {
    const user = userEvent.setup();
    const onRunAction = vi.fn();
    render(
      <ActionsPanel
        actions={votingActions(null, true)}
        roundStatus="VOTING"
        onRunAction={onRunAction}
      />,
    );

    const revelar = screen.getByRole("button", { name: "Revelar veredicto" });
    expect(revelar).toBeEnabled();
    await user.click(revelar);
    expect(onRunAction).toHaveBeenCalledWith("reveal");
  });

  it("marca los pasos hechos y el paso actual con su siguiente acción", () => {
    const actions: OperatorActionView[] = [
      { id: "open", label: "Abrir mercado", done: true, enabled: false, blockedReason: null },
      { id: "last_call", label: "Declarar última llamada", done: false, enabled: true, blockedReason: null },
      { id: "close", label: "Cerrar mercado", done: false, enabled: false, blockedReason: "Requiere el mercado abierto." },
      { id: "reveal", label: "Revelar veredicto", done: false, enabled: false, blockedReason: "Requiere votación habilitada." },
      { id: "next", label: "Siguiente startup", done: false, enabled: false, blockedReason: null },
    ];
    render(<ActionsPanel actions={actions} roundStatus="OPEN" onRunAction={() => {}} />);

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("Hecho")).toBeInTheDocument();
    expect(within(items[1]).getByText("Siguiente acción")).toBeInTheDocument();
    expect(within(items[2]).queryByText("Requiere el mercado abierto.")).toBeNull();
  });
});
