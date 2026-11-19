// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JuryActions, JuryVoteView } from "../types";
import { VotePanel } from "./VotePanel";

afterEach(cleanup);

const IDLE_VOTE: JuryVoteView = {
  draft: null,
  confirming: false,
  submitting: false,
  errorMessage: null,
};

/** Acciones simuladas del portal con funciones espía. */
function makeActions(): JuryActions {
  return {
    submitCode: vi.fn(),
    selectDecision: vi.fn(),
    requestConfirm: vi.fn(),
    cancelConfirm: vi.fn(),
    confirmVote: vi.fn(),
  };
}

describe("VotePanel", () => {
  it("presenta las tres decisiones como un grupo de radios con su descripción", () => {
    render(<VotePanel startupName="AguaClara" vote={IDLE_VOTE} actions={makeActions()} />);

    const group = screen.getByRole("radiogroup", { name: "Decisión de voto" });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /Me abstengo/ })).toHaveAccessibleName(/Declaro conflicto de interés/);
    expect(screen.getByRole("heading", { name: "¿Respaldas a AguaClara?" })).toBeInTheDocument();
  });

  it("mantiene deshabilitada la confirmación hasta elegir una decisión", () => {
    render(<VotePanel startupName="AguaClara" vote={IDLE_VOTE} actions={makeActions()} />);

    expect(screen.getByRole("button", { name: "Confirmar voto" })).toBeDisabled();
  });

  it("informa la decisión elegida al grupo", async () => {
    const actions = makeActions();
    render(<VotePanel startupName="AguaClara" vote={IDLE_VOTE} actions={actions} />);

    await userEvent.click(screen.getByRole("radio", { name: /Rechaza/ }));

    expect(actions.selectDecision).toHaveBeenCalledWith("REJECT");
  });

  it("marca la decisión elegida y habilita la confirmación", () => {
    render(
      <VotePanel
        startupName="AguaClara"
        vote={{ ...IDLE_VOTE, draft: "BACK" }}
        actions={makeActions()}
      />,
    );

    expect(screen.getByRole("radio", { name: /Respalda/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Confirmar voto" })).toBeEnabled();
  });

  it("abre la confirmación del voto definitivo y permite volver", async () => {
    const actions = makeActions();
    render(
      <VotePanel
        startupName="AguaClara"
        vote={{ ...IDLE_VOTE, draft: "BACK", confirming: true }}
        actions={actions}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "¿Confirmas tu voto?" });
    expect(dialog).toHaveTextContent("Vas a votar: Respalda");
    await userEvent.click(within(dialog).getByRole("button", { name: "Volver" }));

    expect(actions.cancelConfirm).toHaveBeenCalledTimes(1);
  });

  it("registra el voto desde la confirmación", async () => {
    const actions = makeActions();
    render(
      <VotePanel
        startupName="AguaClara"
        vote={{ ...IDLE_VOTE, draft: "ABSTAIN", confirming: true }}
        actions={actions}
      />,
    );

    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar voto" }),
    );

    expect(actions.confirmVote).toHaveBeenCalledTimes(1);
  });

  it("muestra el error del último intento como alerta", () => {
    render(
      <VotePanel
        startupName="AguaClara"
        vote={{ ...IDLE_VOTE, draft: "BACK", errorMessage: "La votación ya cerró." }}
        actions={makeActions()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("La votación ya cerró.");
  });

  it("bloquea las opciones mientras el voto se envía", () => {
    render(
      <VotePanel
        startupName="AguaClara"
        vote={{ ...IDLE_VOTE, draft: "BACK", submitting: true, confirming: true }}
        actions={makeActions()}
      />,
    );

    expect(screen.getByRole("radio", { name: /Respalda/ })).toBeDisabled();
  });
});
