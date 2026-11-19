// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveDot } from "./LiveDot";

afterEach(cleanup);

describe("LiveDot", () => {
  it("es decorativo y se oculta de las tecnologías de apoyo sin etiqueta", () => {
    const { container } = render(<LiveDot />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("se expone como imagen con etiqueta accesible cuando recibe label", () => {
    render(<LiveDot label="En vivo" />);
    expect(screen.getByRole("img", { name: "En vivo" })).toBeInTheDocument();
  });
});
