// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RoundSummary } from "../types";
import { RoundHistory } from "./RoundHistory";

afterEach(cleanup);

const rounds: RoundSummary[] = [
  { number: 1, startupName: "Aurora Agro", state: "settled", invested: 500, gain: 200 },
  { number: 2, startupName: "Nodo Solar", state: "settled", invested: 300, gain: -240 },
  { number: 3, startupName: "Aqua Lima", state: "settled", invested: 0, gain: 0 },
  { number: 4, startupName: "Tejido Vivo", state: "annulled", invested: 400, gain: 0 },
  { number: 5, startupName: "Ruta Verde", state: "pending", invested: 0, gain: null },
];

describe("RoundHistory", () => {
  it("lista solo las rondas terminadas en las que el asistente invirtió", () => {
    render(<RoundHistory rounds={rounds} />);

    expect(screen.getByRole("region", { name: "Tus rondas" })).toBeInTheDocument();
    expect(screen.getByText("R1 · Aurora Agro")).toBeInTheDocument();
    expect(screen.getByText("R2 · Nodo Solar")).toBeInTheDocument();
    expect(screen.queryByText(/Aqua Lima/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ruta Verde/)).not.toBeInTheDocument();
  });

  it("muestra la ganancia o la pérdida neta de cada ronda con su signo", () => {
    render(<RoundHistory rounds={rounds} />);

    expect(screen.getByText("+200")).toBeInTheDocument();
    expect(screen.getByText("−240")).toBeInTheDocument();
  });

  it("marca las rondas anuladas en lugar de mostrar su retorno", () => {
    render(<RoundHistory rounds={rounds} />);

    expect(screen.getByText("R4 · Tejido Vivo")).toBeInTheDocument();
    expect(screen.getByText("Anulada")).toBeInTheDocument();
  });

  it("no se muestra cuando todavía no hay rondas con inversión terminada", () => {
    const { container } = render(
      <RoundHistory rounds={[{ number: 1, startupName: "Aurora Agro", state: "current", invested: 100, gain: null }]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
