// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RoundSummary } from "../types";
import { RoundRail } from "./RoundRail";

afterEach(cleanup);

const rounds: RoundSummary[] = [
  { number: 1, startupName: "Aurora Agro", state: "settled", invested: 500, gain: 200 },
  { number: 2, startupName: "Nodo Solar", state: "current", invested: 0, gain: null },
  { number: 3, startupName: "Aqua Lima", state: "pending", invested: 0, gain: null },
  { number: 4, startupName: "Tejido Vivo", state: "annulled", invested: 300, gain: 0 },
  { number: 5, startupName: "Ruta Verde", state: "settled", invested: 0, gain: 0 },
];

describe("RoundRail", () => {
  it("lista todas las rondas con su startup y su estado", () => {
    render(<RoundRail rounds={rounds} />);

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("Aurora Agro");
    expect(items[0]).toHaveTextContent("+200 coins");
    expect(items[1]).toHaveTextContent("En escena");
    expect(items[2]).toHaveTextContent("Pendiente");
    expect(items[3]).toHaveTextContent("Anulada");
    expect(items[4]).toHaveTextContent("Sin inversión");
  });

  it("marca la ronda en curso con aria-current y solo a ella", () => {
    render(<RoundRail rounds={rounds} />);

    const current = screen.getAllByRole("listitem").filter((item) => item.hasAttribute("aria-current"));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Nodo Solar");
    expect(current[0]).toHaveAttribute("aria-current", "step");
  });

  it("identifica el riel con un encabezado de sección", () => {
    render(<RoundRail rounds={rounds} />);

    expect(screen.getByRole("region", { name: "Rondas" })).toBeInTheDocument();
  });
});
