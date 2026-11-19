// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { StandingInfo } from "../types";
import { RankingPanel } from "./RankingPanel";

afterEach(cleanup);

/** Clasificación de referencia: el asistente ocupa el puesto 4 y venía del 6. */
function standing(overrides: Partial<StandingInfo> = {}): StandingInfo {
  return {
    position: 4,
    previousPosition: 6,
    participants: 74,
    hits: 1,
    hitsTotal: 2,
    topThree: [
      { position: 1, name: "Sofía", balance: 12_000, isCurrent: false },
      { position: 2, name: "Carlos", balance: 11_000, isCurrent: false },
      { position: 3, name: "Lucía", balance: 10_900, isCurrent: false },
    ],
    me: { position: 4, name: "Tú", balance: 10_200, isCurrent: true },
    ...overrides,
  };
}

describe("RankingPanel", () => {
  it("muestra la posición del asistente sobre el total de participantes", () => {
    render(<RankingPanel standing={standing()} showDelta={false} />);

    expect(screen.getByText("Tu posición")).toBeInTheDocument();
    expect(screen.getByText("#4")).toBeInTheDocument();
    expect(screen.getByText("de 74")).toBeInTheDocument();
  });

  it("lista las tres primeras posiciones con su saldo", () => {
    render(<RankingPanel standing={standing()} showDelta={false} />);

    const list = screen.getByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("1 · Sofía");
    expect(rows[0]).toHaveTextContent("12,000");
  });

  it("muestra la variación frente a la ronda anterior cuando la ronda ya fue liquidada", () => {
    render(<RankingPanel standing={standing()} showDelta />);

    expect(screen.getByText("▲ 2")).toBeInTheDocument();
  });

  it("oculta la variación mientras la ronda sigue en curso", () => {
    render(<RankingPanel standing={standing()} showDelta={false} />);

    expect(screen.queryByText(/▲|▼|= igual/)).not.toBeInTheDocument();
  });

  it("indica una posición que bajó y una que se mantuvo", () => {
    const { unmount } = render(
      <RankingPanel standing={standing({ position: 9, previousPosition: 6 })} showDelta />,
    );
    expect(screen.getByText("▼ 3")).toBeInTheDocument();
    unmount();

    render(<RankingPanel standing={standing({ position: 6, previousPosition: 6 })} showDelta />);
    expect(screen.getByText("= igual")).toBeInTheDocument();
  });
});
