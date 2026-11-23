// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { DEFAULT_JURY_CRITERIA } from "../criteria";
import { ResultPanel } from "./ResultPanel";

afterEach(cleanup);

describe("ResultPanel", () => {
  it("muestra el puntaje de la startup, su porcentaje, el multiplicador y las notas de los cuatro jurados", () => {
    render(
      <ResultPanel
        criteria={DEFAULT_JURY_CRITERIA}
        reveal={{
          startupScore: 4,
          multiplier: 1.4,
          isLastRound: false,
          jurors: [
            {
              label: "Jurado 1",
              isOwn: false,
              submitted: true,
              abstained: false,
              score: 4.25,
              notes: { "1": 5, "2": 4, "3": 4, "4": 4 },
            },
            {
              label: "Jurado 2",
              isOwn: true,
              submitted: true,
              abstained: false,
              score: 3.75,
              notes: { "1": 4, "2": 4, "3": 3, "4": 4 },
            },
            {
              label: "Jurado 3",
              isOwn: false,
              submitted: true,
              abstained: true,
              score: null,
              notes: {},
            },
            {
              label: "Jurado 4",
              isOwn: false,
              submitted: false,
              abstained: false,
              score: null,
              notes: {},
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("1.4x")).toBeInTheDocument();
    expect(screen.getByText("4.0 / 5")).toBeInTheDocument();
    expect(screen.getByText("75% de la escala")).toBeInTheDocument();

    expect(screen.getByText("Jurado 1").nextElementSibling).toHaveTextContent("4.25 / 5");
    expect(screen.getByText("Jurado 2 (tú)").nextElementSibling).toHaveTextContent("3.75 / 5");
    expect(screen.getByText("Jurado 3").nextElementSibling).toHaveTextContent("Se abstuvo");
    expect(screen.getByText("Jurado 4").nextElementSibling).toHaveTextContent("Sin envío");

    const juror1Notes = screen.getByRole("list", { name: "Notas de Jurado 1" });
    expect(within(juror1Notes).getByText("Problema y mercado").nextElementSibling).toHaveTextContent("5");
    expect(screen.queryByRole("list", { name: "Notas de Jurado 3" })).not.toBeInTheDocument();
    expect(screen.getByText("El operador pasará a la siguiente startup.")).toBeInTheDocument();
  });

  it("indica cuando la ronda liquidada es la última del evento", () => {
    render(
      <ResultPanel
        criteria={DEFAULT_JURY_CRITERIA}
        reveal={{
          startupScore: 3,
          multiplier: 1,
          isLastRound: true,
          jurors: [],
        }}
      />,
    );

    expect(screen.getByText("1.0x")).toBeInTheDocument();
    expect(screen.getByText("3.0 / 5")).toBeInTheDocument();
    expect(screen.getByText("50% de la escala")).toBeInTheDocument();
    expect(screen.getByText("Última ronda. El operador cerrará el evento.")).toBeInTheDocument();
  });

  it("omite la lista de notas cuando un jurado enviado no tiene detalle por criterio y muestra guion si faltan totales", () => {
    render(
      <ResultPanel
        criteria={DEFAULT_JURY_CRITERIA}
        reveal={{
          startupScore: null,
          multiplier: null,
          isLastRound: false,
          jurors: [
            {
              label: "Jurado 1",
              isOwn: false,
              submitted: true,
              abstained: false,
              score: 4,
              notes: {},
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("4.0 / 5")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Notas de Jurado 1" })).not.toBeInTheDocument();
  });
});
