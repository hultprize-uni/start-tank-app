// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockScreen } from "../api/mock";
import { ClosingPhase, MarketPhase, Rail, RevealPhase, VotingPhase, WaitingPhase } from "./phases";

afterEach(cleanup);

describe("stage phases", () => {
  it("presents the next startup while waiting", () => {
    render(<WaitingPhase vm={mockScreen("WAITING")} />);
    expect(screen.getByText("A continuación")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "AgroSense" })).toBeInTheDocument();
    expect(screen.getByText("El mercado abrirá en breve.")).toBeInTheDocument();
  });

  it("shows the room amount, the live price and who already invested", () => {
    render(<MarketPhase vm={mockScreen("MARKET")} />);
    const market = screen.getByRole("region", { name: "Mercado de la ronda" });
    expect(within(market).getByText("47 de 80")).toBeInTheDocument();
    expect(within(market).getByRole("timer")).toHaveAccessibleName(/^Pitch: quedan 02:(4|3)\d$/);
  });

  it("lights the jury seats without showing any score while voting", () => {
    render(<VotingPhase vm={mockScreen("VOTING")} />);
    expect(screen.getByText("3 de 4 jurados ya enviaron sus notas. Las notas se revelan todas a la vez.")).toBeInTheDocument();
    expect(screen.getAllByText("Notas enviadas")).toHaveLength(3);
    expect(screen.getByText("Calificando")).toBeInTheDocument();
    expect(screen.queryByText("4.25")).not.toBeInTheDocument();
  });

  it("reveals the four scores, the multiplier and what the room receives", () => {
    render(<RevealPhase vm={mockScreen("REVEAL")} />);
    const verdict = screen.getByRole("region", { name: "Veredicto de la ronda" });
    expect(within(verdict).getByText("1.4x")).toBeInTheDocument();
    expect(within(verdict).getAllByText("4.25")).toHaveLength(2);
    expect(within(verdict).getByText("+22,600")).toBeInTheDocument();
    expect(within(verdict).getByText("Puntaje del jurado 4.0 de 5, 75%")).toBeInTheDocument();
  });

  it("marks how each investor moved after the verdict", () => {
    render(<Rail vm={mockScreen("REVEAL")} />);
    const table = screen.getByRole("region", { name: "Inversores por patrimonio" });
    expect(within(table).getByLabelText("sube 3")).toBeInTheDocument();
    expect(within(table).getAllByLabelText("baja 2")).toHaveLength(2);
  });

  it("names the winner, the top 3 and the best eye at the close", () => {
    render(<ClosingPhase vm={mockScreen("CLOSING")} />);
    expect(screen.getByRole("heading", { level: 1, name: "SolRed" })).toBeInTheDocument();
    expect(screen.getByText("0.81")).toBeInTheDocument();
    expect(screen.getByText("Lucía H.")).toBeInTheDocument();
    expect(screen.getByText("Acertó 5 de 5 rondas.")).toBeInTheDocument();
  });
});
