// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { JURY_CRITERIA } from "../criteria";
import type { JuryActions, JuryViewModel } from "../types";
import { JurySession } from "./JurySession";

afterEach(cleanup);

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

/** Vista de la sesión con valores por defecto que cada caso sobrescribe. */
function viewOf(overrides: Partial<JuryViewModel>): JuryViewModel {
  return {
    screen: "waiting",
    phase: "scheduled",
    access: { status: "idle", errorMessage: null },
    jurorLabel: "Jurado 2",
    round: {
      number: 2,
      total: 5,
      startupName: "AguaClara",
      sdg: "ODS 6",
      description: "Filtros comunitarios de agua.",
    },
    rail: [
      { number: 1, startupName: "AgroSense", status: "settled", ownDecision: "BACK" },
      { number: 2, startupName: "AguaClara", status: "current", ownDecision: null },
      { number: 3, startupName: "EduRuta", status: "pending", ownDecision: null },
    ],
    criteria: JURY_CRITERIA,
    vote: { draft: null, confirming: false, submitting: false, errorMessage: null },
    votes: { emitted: 0, total: 4 },
    ownVote: null,
    reveal: null,
    ...overrides,
  };
}

function renderSession(state: JuryViewModel) {
  return render(<JurySession jurorLabel="Jurado 2" state={state} actions={makeActions()} />);
}

describe("JurySession", () => {
  it("muestra la startup, los criterios y el recorrido de rondas", () => {
    renderSession(viewOf({}));

    expect(screen.getByRole("heading", { level: 2, name: "AguaClara" })).toBeInTheDocument();
    expect(screen.getByText("ODS 6")).toBeInTheDocument();
    expect(screen.getByText("Viabilidad del negocio")).toBeInTheDocument();
    expect(screen.getByText("Impacto alineado con los ODS")).toBeInTheDocument();

    const rail = screen.getByRole("complementary", { name: "Recorrido del evento" });
    expect(within(rail).getByText("Tu voto: Respalda")).toBeInTheDocument();
    expect(within(rail).getByText("En escena")).toBeInTheDocument();
    expect(within(rail).getByText("Pendiente")).toBeInTheDocument();
    expect(within(rail).getByText("En escena").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("espera la votación con la etiqueta de la fase y la posición de la ronda", () => {
    renderSession(viewOf({ phase: "open", screen: "waiting" }));

    expect(screen.getByText("Mercado abierto")).toBeInTheDocument();
    expect(screen.getByText("Ronda 2 de 5")).toBeInTheDocument();
    expect(screen.getByText("Pitch en curso")).toBeInTheDocument();
  });

  it("explica que la ronda no inicia cuando sigue programada", () => {
    renderSession(viewOf({ phase: "scheduled", screen: "waiting" }));

    expect(screen.getByRole("heading", { name: "Aún no empieza esta ronda" })).toBeInTheDocument();
  });

  it("presenta la votación con las tres opciones y la confirmación deshabilitada", () => {
    renderSession(viewOf({ phase: "voting", screen: "voting" }));

    expect(screen.getByRole("heading", { name: "¿Respaldas a AguaClara?" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Decisión de voto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar voto" })).toBeDisabled();
  });

  it("confirma el voto registrado con el conteo de votos emitidos", () => {
    renderSession(
      viewOf({
        phase: "voting",
        screen: "vote_registered",
        ownVote: "REJECT",
        votes: { emitted: 2, total: 4 },
      }),
    );

    expect(screen.getByText("Voto registrado")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rechaza" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Votos emitidos" })).toHaveAttribute(
      "aria-valuenow",
      "2",
    );
    expect(screen.getByText("2 de 4 votos emitidos")).toBeInTheDocument();
  });

  it("publica el veredicto con el multiplicador y los votos de los cuatro jurados", () => {
    renderSession(
      viewOf({
        phase: "result",
        screen: "result",
        round: {
          number: 1,
          total: 5,
          startupName: "AgroSense",
          sdg: "ODS 2",
          description: null,
        },
        reveal: {
          multiplier: 1.4,
          isLastRound: false,
          votes: [
            { label: "Jurado 1", isOwn: false, decision: "BACK" },
            { label: "Jurado 2", isOwn: true, decision: "REJECT" },
            { label: "Jurado 3", isOwn: false, decision: "ABSTAIN" },
            { label: "Jurado 4", isOwn: false, decision: null },
          ],
        },
      }),
    );

    expect(screen.getByText("1.4x")).toBeInTheDocument();
    expect(screen.getByText("Jurado 2 (tú)").nextElementSibling).toHaveTextContent("Rechaza");
    expect(screen.getByText("Jurado 4").nextElementSibling).toHaveTextContent("Sin voto");
    expect(screen.getByText("El operador pasará a la siguiente startup.")).toBeInTheDocument();
  });

  it("indica que la última ronda es la última del evento", () => {
    renderSession(
      viewOf({
        phase: "result",
        screen: "result",
        reveal: { multiplier: 1, isLastRound: true, votes: [] },
      }),
    );

    expect(screen.getByText("Última ronda. El operador cerrará el evento.")).toBeInTheDocument();
  });

  it("muestra la anulación sin pedir voto", () => {
    renderSession(viewOf({ phase: "cancelled", screen: "waiting" }));

    expect(screen.getByRole("heading", { name: "Ronda anulada" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("cierra el evento sin ronda visible y conserva el historial", () => {
    renderSession(
      viewOf({
        phase: "final",
        screen: "waiting",
        round: null,
        rail: [{ number: 1, startupName: "AgroSense", status: "settled", ownDecision: "BACK" }],
      }),
    );

    expect(screen.getByRole("heading", { name: "Evento cerrado" })).toBeInTheDocument();
    expect(screen.queryByText("Criterios · mismo peso")).not.toBeInTheDocument();
    expect(screen.getByText("Tus votos")).toBeInTheDocument();
    expect(screen.getByText("R1 · AgroSense")).toBeInTheDocument();
  });
});
