// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Spinner } from "./Spinner";

afterEach(cleanup);

describe("Spinner", () => {
  it("se anuncia como estado con la etiqueta predeterminada", () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Cargando" })).toBeInTheDocument();
  });

  it("acepta una etiqueta accesible configurable", () => {
    render(<Spinner label="Enviando inversión" />);
    expect(
      screen.getByRole("status", { name: "Enviando inversión" }),
    ).toBeInTheDocument();
  });

  it("se oculta de las tecnologías de apoyo cuando es decorativo", () => {
    const { container } = render(<Spinner decorative />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
