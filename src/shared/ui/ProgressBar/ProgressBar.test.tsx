// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar";

afterEach(cleanup);

describe("ProgressBar", () => {
  it("expone el rol progressbar con su nombre y los valores ARIA", () => {
    render(<ProgressBar label="Tope de la ronda" value={30} max={60} />);
    const bar = screen.getByRole("progressbar", { name: "Tope de la ronda" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "60");
    expect(bar).toHaveAttribute("aria-valuenow", "30");
  });

  it("limita el valor al intervalo entre 0 y el máximo", () => {
    const { rerender } = render(<ProgressBar label="Avance" value={150} max={100} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

    rerender(<ProgressBar label="Avance" value={-5} max={100} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("expone el texto legible del valor cuando se recibe", () => {
    render(<ProgressBar label="Rondas" value={3} max={5} valueText="3 de 5 rondas" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "3 de 5 rondas",
    );
  });
});
