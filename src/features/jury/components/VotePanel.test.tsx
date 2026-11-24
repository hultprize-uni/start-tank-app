// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_JURY_CRITERIA } from "../criteria";
import type { JuryActions, JuryVoteUiState } from "../types";
import { VotePanel } from "./VotePanel";

afterEach(cleanup);

const IDLE_VOTE: JuryVoteUiState = {
  sheet: null,
  submitting: false,
  errorMessage: null,
};

function makeActions(): JuryActions {
  return {
    submitCode: vi.fn(),
    setScore: vi.fn(),
    openConfirmSend: vi.fn(),
    openAbstain: vi.fn(),
    closeSheet: vi.fn(),
    confirmSend: vi.fn(),
    confirmAbstain: vi.fn(),
    logout: vi.fn(),
  };
}

describe("VotePanel", () => {
  it("muestra los cuatro criterios de evaluación con su escala de 1 a 5", () => {
    render(
      <VotePanel
        startupName="AguaClara"
        phase="open"
        criteria={DEFAULT_JURY_CRITERIA}
        draftNotes={{}}
        draftStatus="idle"
        draftError={null}
        vote={IDLE_VOTE}
        actions={makeActions()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Califica a AguaClara" })).toBeInTheDocument();
    expect(screen.getAllByRole("radiogroup")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Enviar notas" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Declarar conflicto de interés" })).toBeDisabled();
  });

  it("notifica setScore al elegir una nota en un criterio", async () => {
    const actions = makeActions();
    render(
      <VotePanel
        startupName="AguaClara"
        phase="open"
        criteria={DEFAULT_JURY_CRITERIA}
        draftNotes={{}}
        draftStatus="idle"
        draftError={null}
        vote={IDLE_VOTE}
        actions={actions}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Puntaje para Problema y mercado" });
    await userEvent.click(within(group).getByRole("radio", { name: /4 Sólido/ }));

    expect(actions.setScore).toHaveBeenCalledWith("1", 4);
  });

  it("habilita el envío y la abstención en votación con los cuatro criterios completos", async () => {
    const actions = makeActions();
    render(
      <VotePanel
        startupName="AguaClara"
        phase="voting"
        criteria={DEFAULT_JURY_CRITERIA}
        draftNotes={{ "1": 5, "2": 4, "3": 4, "4": 3 }}
        draftStatus="saved"
        draftError={null}
        vote={IDLE_VOTE}
        actions={actions}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Enviar notas" }));
    expect(actions.openConfirmSend).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Declarar conflicto de interés" }));
    expect(actions.openAbstain).toHaveBeenCalledTimes(1);
  });

  it("abre ConfirmSendSheet cuando sheet vale confirm_send y confirma el envío", async () => {
    const actions = makeActions();
    render(
      <VotePanel
        startupName="AguaClara"
        phase="voting"
        criteria={DEFAULT_JURY_CRITERIA}
        draftNotes={{ "1": 4, "2": 4, "3": 4, "4": 4 }}
        draftStatus="saved"
        draftError={null}
        vote={{ ...IDLE_VOTE, sheet: "confirm_send" }}
        actions={actions}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "¿Confirmas el envío de tus notas?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar envío" }));
    expect(actions.confirmSend).toHaveBeenCalledTimes(1);
  });

  it("abre AbstainSheet cuando sheet vale abstain y confirma tras elegir motivo", async () => {
    const actions = makeActions();
    render(
      <VotePanel
        startupName="AguaClara"
        phase="voting"
        criteria={DEFAULT_JURY_CRITERIA}
        draftNotes={{}}
        draftStatus="idle"
        draftError={null}
        vote={{ ...IDLE_VOTE, sheet: "abstain" }}
        actions={actions}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Declarar conflicto de interés" });
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Vínculo familiar o personal con el equipo" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar abstención" }));
    expect(actions.confirmAbstain).toHaveBeenCalledTimes(1);
  });

  it("muestra errores de borrador o envío como alerta", () => {
    render(
      <VotePanel
        startupName="AguaClara"
        phase="voting"
        criteria={DEFAULT_JURY_CRITERIA}
        draftNotes={{}}
        draftStatus="error"
        draftError="No se pudo guardar el borrador."
        vote={IDLE_VOTE}
        actions={makeActions()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar el borrador.");
  });
});
