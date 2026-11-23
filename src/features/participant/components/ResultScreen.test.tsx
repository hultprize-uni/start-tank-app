// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { StartupInfo, VerdictInfo } from "../types";
import { ResultScreen } from "./ResultScreen";

afterEach(cleanup);

const startup: StartupInfo = { name: "Nodo Solar", sdg: "ODS 7", description: "", logoUrl: null };
const round = { number: 2, total: 5 };

/** Liquidada hace 10 segundos: el retraso del teléfono ya pasó. */
const past = new Date(Date.now() - 10_000).toISOString();

function verdict(overrides: Partial<VerdictInfo> = {}): VerdictInfo {
  return {
    juryScore: 4,
    scorePct: 75,
    multiplier: 1.4,
    invested: 1_000,
    payout: 1_400,
    gain: 400,
    annulment: null,
    settledAt: past,
    ...overrides,
  };
}

describe("ResultScreen", () => {
  it("espera 3 segundos después de la liquidación antes de revelar", () => {
    render(
      <ResultScreen
        round={round}
        startup={startup}
        verdict={verdict({ settledAt: new Date().toISOString() })}
        balance={10_400}
      />,
    );

    expect(screen.getByText("Mira el escenario: el jurado está revelando su puntaje.")).toBeInTheDocument();
    expect(screen.queryByText("1.4x")).not.toBeInTheDocument();
  });

  it("muestra el puntaje en porcentaje, el multiplicador y el resultado", () => {
    render(<ResultScreen round={round} startup={startup} verdict={verdict()} balance={10_400} />);

    expect(screen.getByText("Veredicto · Ronda 2")).toBeInTheDocument();
    expect(screen.getByText(/75 %/)).toBeInTheDocument();
    expect(screen.getByText("1.4x")).toBeInTheDocument();
    expect(screen.getByText("+400")).toBeInTheDocument();
    expect(screen.getByText("Esperando la ronda 3")).toBeInTheDocument();
  });

  it("explica la anulación sin puntaje del jurado", () => {
    render(
      <ResultScreen
        round={round}
        startup={startup}
        verdict={verdict({ juryScore: null, scorePct: null, multiplier: 1, payout: 1_000, gain: 0, annulment: "refund" })}
        balance={10_000}
      />,
    );

    expect(screen.getByText("Ronda anulada")).toBeInTheDocument();
    expect(
      screen.getByText("El conductor anuló la ronda. Tu inversión volvió íntegra a tu saldo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Puntaje del jurado")).not.toBeInTheDocument();
  });

  it("anuncia el cierre del evento en la última ronda", () => {
    render(
      <ResultScreen round={{ number: 5, total: 5 }} startup={startup} verdict={verdict()} balance={10_400} />,
    );
    expect(screen.getByText("Esperando el cierre del evento")).toBeInTheDocument();
  });
});
