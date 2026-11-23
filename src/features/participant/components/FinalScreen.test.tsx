// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { StandingInfo } from "../types";
import { FinalScreen } from "./FinalScreen";

afterEach(cleanup);

const standing: StandingInfo = {
  position: 3,
  previousPosition: 5,
  participants: 74,
  hits: 2,
  hitsTotal: 5, streak: 0, window: [], distanceToFirst: 0, distanceToPodium: 0,
  topThree: [],
  me: { position: 3, name: "Tú", balance: 12_480, isCurrent: true, previousPosition: null },
};

describe("FinalScreen", () => {
  it("muestra el saldo final, la posición y los aciertos del evento", () => {
    render(<FinalScreen balance={12_480} standing={standing} winnerStartup={null} />);

    expect(screen.getByText("Fin del evento")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Gracias por invertir." })).toBeInTheDocument();
    expect(screen.getByText("Saldo final")).toBeInTheDocument();
    expect(screen.getByText("12,480")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("2 de 5")).toBeInTheDocument();
  });

  it("anuncia la premiación en la pantalla del auditorio", () => {
    render(<FinalScreen balance={12_480} standing={standing} winnerStartup={null} />);

    expect(
      screen.getByText("La startup ganadora y el premio al mejor ojo se anuncian en la pantalla del auditorio."),
    ).toBeInTheDocument();
  });
});
