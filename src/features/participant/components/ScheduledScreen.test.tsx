// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScheduledScreen } from "./ScheduledScreen";

afterEach(cleanup);

describe("ScheduledScreen", () => {
  it("presenta la startup de la ronda programada con su ODS y su descripción", () => {
    render(
      <ScheduledScreen
        round={{ number: 1, total: 5 }}
        startup={{ name: "Aurora Agro", sdg: "ODS 2 · Hambre cero", description: "Agro de precisión.", logoUrl: null }}
        balance={10_400}
        streak={2}
      />,
    );
    expect(screen.getByText("10,400 coins")).toBeInTheDocument();
    expect(screen.getByText("2 aciertos")).toBeInTheDocument();

    expect(screen.getByText("Ronda 1 de 5 · Programada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Aurora Agro" })).toBeInTheDocument();
    expect(screen.getByText("ODS 2 · Hambre cero")).toBeInTheDocument();
    expect(screen.getByText("Agro de precisión.")).toBeInTheDocument();
    expect(screen.getByText(/El mercado abre cuando empiece el pitch/)).toBeInTheDocument();
  });
});
