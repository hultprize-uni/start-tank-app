// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VotingScreen } from "./VotingScreen";

afterEach(cleanup);

describe("VotingScreen", () => {
  it("informa que el mercado cerró y que el jurado delibera", () => {
    render(
      <VotingScreen
        round={{ number: 3, total: 5 }}
        startup={{ name: "Aqua Lima", sdg: "ODS 6", description: "" }}
        wallet={{ balance: 8_000, investedInRound: 750, roundCap: 2_700 }}
      />,
    );

    expect(screen.getByText("Mercado cerrado")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "El jurado delibera." })).toBeInTheDocument();
    expect(screen.getByText(/Aqua Lima · Ronda 3 de 5/)).toBeInTheDocument();
    expect(screen.getByText("750")).toBeInTheDocument();
  });

  it("deja la inversión bloqueada", () => {
    render(
      <VotingScreen
        round={{ number: 3, total: 5 }}
        startup={{ name: "Aqua Lima", sdg: "ODS 6", description: "" }}
        wallet={{ balance: 8_000, investedInRound: 0, roundCap: 2_700 }}
      />,
    );

    expect(screen.getByRole("button", { name: "Invertir · bloqueado" })).toBeDisabled();
  });
});
