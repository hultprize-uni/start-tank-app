// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RoundStatus } from "./RoundStatus";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const ROUND = {
  number: 2,
  total: 5,
  startupName: "AguaClara",
  sdg: "ODS 6",
  description: "Filtros comunitarios de agua.",
};

describe("RoundStatus", () => {
  it("muestra la fase, la startup en escena y la posición de la ronda", () => {
    render(<RoundStatus phase="open" round={ROUND} clock={null} />);

    expect(screen.getByText("Mercado abierto")).toBeInTheDocument();
    expect(screen.getByText("AguaClara")).toBeInTheDocument();
    expect(screen.getByText("Ronda 2 de 5")).toBeInTheDocument();
    expect(screen.queryByLabelText("Tiempo restante de la fase")).not.toBeInTheDocument();
  });

  it("muestra el cronómetro sincronizado con la hora del servidor", () => {
    vi.useFakeTimers();
    const now = new Date("2026-11-26T15:00:00.000Z");
    vi.setSystemTime(now);

    render(
      <RoundStatus
        phase="voting"
        round={ROUND}
        clock={{
          serverTime: now.toISOString(),
          phaseEndsAt: "2026-11-26T15:02:15.000Z",
          paused: false,
          pausedSeconds: null,
        }}
      />,
    );

    expect(screen.getByLabelText("Tiempo restante de la fase")).toHaveTextContent("02:15");
  });

  it("muestra el tiempo congelado e indicador de pausa cuando el operador pausa", () => {
    render(
      <RoundStatus
        phase="open"
        round={ROUND}
        clock={{
          serverTime: "2026-11-26T15:00:00.000Z",
          phaseEndsAt: null,
          paused: true,
          pausedSeconds: 95,
        }}
      />,
    );

    expect(screen.getByText("En pausa")).toBeInTheDocument();
    expect(screen.getByText("Pausado")).toBeInTheDocument();
    expect(screen.getByLabelText("Tiempo restante de la fase")).toHaveTextContent("01:35");
  });
});
