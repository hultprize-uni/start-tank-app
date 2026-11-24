// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { DEFAULT_JURY_CRITERIA } from "../criteria";
import type { JuryActions, JuryViewModel } from "../types";
import { JurySession } from "./JurySession";

afterEach(cleanup);

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

function viewOf(overrides: Partial<JuryViewModel>): JuryViewModel {
  return {
    screen: "waiting",
    phase: "scheduled",
    clock: null,
    access: { status: "idle", errorMessage: null },
    jurorLabel: "Jurado 2",
    round: {
      id: "2",
      number: 2,
      total: 5,
      startupName: "AguaClara",
      sdg: "ODS 6",
      description: "Filtros comunitarios de agua.",
      logoUrl: null,
    },
    rail: [
      {
        number: 1,
        startupName: "AgroSense",
        status: "settled",
        ownVerdict: { abstained: false, score: 4.25 },
      },
      { number: 2, startupName: "AguaClara", status: "current", ownVerdict: null },
      { number: 3, startupName: "EduRuta", status: "pending", ownVerdict: null },
    ],
    criteria: DEFAULT_JURY_CRITERIA,
    draftNotes: {},
    draftStatus: "idle",
    draftError: null,
    vote: { sheet: null, submitting: false, errorMessage: null },
    votes: { emitted: 0, total: 4 },
    ownVerdict: null,
    reveal: null,
    ...overrides,
  };
}

function renderSession(state: JuryViewModel) {
  return render(<JurySession jurorLabel="Jurado 2" state={state} actions={makeActions()} />);
}

describe("JurySession", () => {
  it("muestra la startup en escena y el recorrido de rondas", () => {
    renderSession(viewOf({}));

    expect(screen.getByRole("heading", { level: 2, name: "AguaClara" })).toBeInTheDocument();
    expect(screen.getByText("ODS 6")).toBeInTheDocument();

    const rail = screen.getByRole("complementary", { name: "Recorrido del evento" });
    expect(within(rail).getByText("Tu puntaje: 4.25 / 5")).toBeInTheDocument();
    expect(within(rail).getByText("En escena")).toBeInTheDocument();
    expect(within(rail).getByText("Pendiente")).toBeInTheDocument();
    expect(within(rail).getByText("En escena").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("permite calificar en borrador durante el mercado abierto con Enviar notas bloqueado", () => {
    renderSession(viewOf({ phase: "open", screen: "grading" }));

    expect(screen.getByText("Mercado abierto")).toBeInTheDocument();
    expect(screen.getByText("Ronda 2 de 5")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Califica a AguaClara" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar notas" })).toBeDisabled();
  });

  it("explica que la ronda no inicia cuando sigue programada", () => {
    renderSession(viewOf({ phase: "scheduled", screen: "waiting" }));

    expect(screen.getByRole("heading", { name: "Aún no empieza esta ronda" })).toBeInTheDocument();
  });

  it("confirma las notas enviadas con el puntaje y el conteo de envíos", () => {
    renderSession(
      viewOf({
        phase: "voting",
        screen: "vote_registered",
        ownVerdict: {
          abstained: false,
          score: 4,
          notes: { "1": 4, "2": 4, "3": 4, "4": 4 },
        },
        votes: { emitted: 2, total: 4 },
      }),
    );

    expect(screen.getByText("Notas enviadas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Puntaje: 4.0 / 5" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Jurados que enviaron" })).toHaveAttribute(
      "aria-valuenow",
      "2",
    );
    expect(screen.getByText("2 de 4 jurados enviaron")).toBeInTheDocument();
  });

  it("publica el veredicto con el puntaje, el multiplicador y las notas de los cuatro jurados", () => {
    renderSession(
      viewOf({
        phase: "result",
        screen: "result",
        round: {
          id: "1",
          number: 1,
          total: 5,
          startupName: "AgroSense",
          sdg: "ODS 2",
          description: null,
          logoUrl: null,
        },
        reveal: {
          startupScore: 4,
          multiplier: 1.4,
          isLastRound: false,
          jurors: [
            { label: "Jurado 1", isOwn: false, submitted: true, abstained: false, score: 4.5, notes: {} },
            { label: "Jurado 2", isOwn: true, submitted: true, abstained: false, score: 3.5, notes: {} },
            { label: "Jurado 3", isOwn: false, submitted: true, abstained: true, score: null, notes: {} },
            { label: "Jurado 4", isOwn: false, submitted: false, abstained: false, score: null, notes: {} },
          ],
        },
      }),
    );

    expect(screen.getByText("1.4x")).toBeInTheDocument();
    expect(screen.getByText("4.0 / 5")).toBeInTheDocument();
    expect(screen.getByText("Jurado 2 (tú)").nextElementSibling).toHaveTextContent("3.5 / 5");
    expect(screen.getByText("Jurado 3").nextElementSibling).toHaveTextContent("Se abstuvo");
    expect(screen.getByText("Jurado 4").nextElementSibling).toHaveTextContent("Sin envío");
    expect(screen.getByText("El operador pasará a la siguiente startup.")).toBeInTheDocument();
  });

  it("muestra la anulación sin pedir calificación", () => {
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
        rail: [
          {
            number: 1,
            startupName: "AgroSense",
            status: "settled",
            ownVerdict: { abstained: false, score: 4.25 },
          },
        ],
      }),
    );

    expect(screen.getByRole("heading", { name: "Evento cerrado" })).toBeInTheDocument();
    expect(screen.getByText("Tus calificaciones")).toBeInTheDocument();
    expect(screen.getByText("R1 · AgroSense")).toBeInTheDocument();
  });
});
