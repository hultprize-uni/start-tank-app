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
        startup={{ name: "Aurora Agro", sdg: "ODS 2 · Hambre cero", description: "Agro de precisión." }}
      />,
    );

    expect(screen.getByText("Ronda 1 de 5 · Programada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Aurora Agro" })).toBeInTheDocument();
    expect(screen.getByText("ODS 2 · Hambre cero")).toBeInTheDocument();
    expect(screen.getByText("Agro de precisión.")).toBeInTheDocument();
    expect(screen.getByText(/abrirá el mercado cuando empiece el pitch/)).toBeInTheDocument();
  });
});
