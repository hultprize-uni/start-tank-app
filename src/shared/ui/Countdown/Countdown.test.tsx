// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Countdown } from "./Countdown";

afterEach(cleanup);

describe("Countdown", () => {
  it("formatea los segundos como mm:ss", () => {
    render(<Countdown seconds={65} />);
    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("muestra 00:00 con valores negativos", () => {
    render(<Countdown seconds={-3} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("expone una fecha de duración ISO y la etiqueta accesible", () => {
    render(<Countdown seconds={60} label="Última llamada" />);
    const time = screen.getByLabelText("Última llamada");
    expect(time).toHaveTextContent("01:00");
    expect(time).toHaveAttribute("dateTime", "PT1M0S");
  });
});
