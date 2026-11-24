// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_JURY_CRITERIA } from "../criteria";
import { ScoreSummary } from "./ScoreSummary";

afterEach(cleanup);

describe("ScoreSummary", () => {
  it("calcula el puntaje ponderado en vivo y muestra el progreso de criterios", () => {
    render(
      <ScoreSummary
        criteria={DEFAULT_JURY_CRITERIA}
        scores={{ "1": 5, "2": 3 }}
        canSubmit={false}
        submitting={false}
        draftStatus="saved"
        hasRecoveredDraft={false}
        onRequestSend={vi.fn()}
      />,
    );

    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("2 de 4 criterios")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Borrador guardado");
  });

  it("mantiene bloqueado Enviar notas mientras la votación no está habilitada", () => {
    render(
      <ScoreSummary
        criteria={DEFAULT_JURY_CRITERIA}
        scores={{ "1": 5, "2": 4, "3": 5, "4": 4 }}
        canSubmit={false}
        submitting={false}
        draftStatus="idle"
        hasRecoveredDraft
        onRequestSend={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Enviar notas" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Se habilita cuando el operador abra la votación.");
    expect(screen.getByRole("status")).toHaveTextContent("Borrador guardado");
  });

  it("mantiene bloqueado Enviar notas si falta algún criterio aunque esté en votación", () => {
    render(
      <ScoreSummary
        criteria={DEFAULT_JURY_CRITERIA}
        scores={{ "1": 4, "2": 4, "3": 4 }}
        canSubmit
        submitting={false}
        draftStatus="saving"
        hasRecoveredDraft={false}
        onRequestSend={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Enviar notas" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Califica 1 criterio restante para enviar.");
    expect(screen.getByRole("status")).toHaveTextContent("Guardando borrador…");
  });

  it("habilita Enviar notas con los cuatro criterios completos en votación y dispara el envío", async () => {
    const onRequestSend = vi.fn();
    render(
      <ScoreSummary
        criteria={DEFAULT_JURY_CRITERIA}
        scores={{ "1": 5, "2": 4, "3": 4, "4": 4 }}
        canSubmit
        submitting={false}
        draftStatus="saved"
        hasRecoveredDraft
        onRequestSend={onRequestSend}
      />,
    );

    const button = screen.getByRole("button", { name: "Enviar notas" });
    expect(button).toBeEnabled();
    expect(screen.getByText("4.25")).toBeInTheDocument();

    await userEvent.click(button);

    expect(onRequestSend).toHaveBeenCalledTimes(1);
  });
});
