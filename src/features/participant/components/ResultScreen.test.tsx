// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Decision } from "@/shared/domain/types";
import type { RoundInfo, StartupInfo, VerdictInfo } from "../types";
import { ResultScreen } from "./ResultScreen";

afterEach(cleanup);

const startup: StartupInfo = { name: "Nodo Solar", sdg: "ODS 7", description: "" };

/** Veredicto con tres respaldos y un rechazo, multiplicador 1.4x sobre 500 coins. */
function verdict(overrides: Partial<VerdictInfo> = {}): VerdictInfo {
  const decisions: Decision[] = ["BACK", "BACK", "BACK", "REJECT"];
  return {
    decisions,
    backs: 3,
    voters: 4,
    multiplier: 1.4,
    invested: 500,
    payout: 700,
    gain: 200,
    annulment: null,
    ...overrides,
  };
}

describe("ResultScreen", () => {
  it("muestra el veredicto con votos, respaldos, multiplicador y ganancia de la ronda", () => {
    const round: RoundInfo = { number: 2, total: 5 };
    render(<ResultScreen round={round} startup={startup} verdict={verdict()} />);

    expect(screen.getByText("Veredicto · Ronda 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Nodo Solar" })).toBeInTheDocument();
    expect(screen.getByText("3 de 4 jurados respaldan")).toBeInTheDocument();
    expect(screen.getByText("1.4x")).toBeInTheDocument();
    expect(screen.getByText("+200")).toBeInTheDocument();
    expect(screen.getByText("Esperando ronda 3")).toBeInTheDocument();
  });

  it("describe cada voto del jurado con texto accesible", () => {
    render(<ResultScreen round={{ number: 1, total: 5 }} startup={startup} verdict={verdict()} />);

    const votes = screen.getByRole("list", { name: "Votos del jurado" });
    const items = within(votes).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Jurado 1: Respalda");
    expect(items[3]).toHaveTextContent("Jurado 4: Rechaza");
  });

  it("aclara las abstenciones sin contarlas como votos emitidos", () => {
    render(
      <ResultScreen
        round={{ number: 2, total: 5 }}
        startup={startup}
        verdict={verdict({
          decisions: ["BACK", "BACK", "REJECT", "ABSTAIN"],
          backs: 2,
          voters: 3,
          multiplier: 1,
          payout: 500,
          gain: 0,
        })}
      />,
    );

    expect(screen.getByText("2 de 3 jurados respaldan · 1 se abstuvo")).toBeInTheDocument();
  });

  it("indica el cierre del evento en la última ronda", () => {
    render(<ResultScreen round={{ number: 5, total: 5 }} startup={startup} verdict={verdict()} />);

    expect(screen.getByText("Esperando el cierre del evento")).toBeInTheDocument();
  });

  it("muestra una pérdida con signo negativo", () => {
    render(
      <ResultScreen
        round={{ number: 1, total: 5 }}
        startup={startup}
        verdict={verdict({ multiplier: 0.2, payout: 100, gain: -400 })}
      />,
    );

    expect(screen.getByText("−400")).toBeInTheDocument();
  });

  it("presenta una ronda anulada con devolución sin votos y con multiplicador 1.0x", () => {
    render(
      <ResultScreen
        round={{ number: 2, total: 5 }}
        startup={startup}
        verdict={verdict({ annulment: "refund", multiplier: 1, payout: 500, gain: 0 })}
      />,
    );

    expect(screen.getByText("Ronda anulada")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Votos del jurado" })).not.toBeInTheDocument();
    expect(
      screen.getByText("El operador anuló la ronda. Tu inversión volvió íntegra a tu saldo."),
    ).toBeInTheDocument();
    expect(screen.getByText("1.0x")).toBeInTheDocument();
  });

  it("presenta una ronda anulada con liquidación a 1.0x con su propio texto", () => {
    render(
      <ResultScreen
        round={{ number: 2, total: 5 }}
        startup={startup}
        verdict={verdict({ annulment: "settle-1x", multiplier: 1, payout: 500, gain: 0 })}
      />,
    );

    expect(screen.getByText("El operador anuló la ronda y la liquidó a 1.0x.")).toBeInTheDocument();
  });
});
