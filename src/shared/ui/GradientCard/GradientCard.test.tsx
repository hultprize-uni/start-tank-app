// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GradientCard } from "./GradientCard";

afterEach(cleanup);

describe("GradientCard", () => {
  it("renderiza el contenido dentro del panel interior", () => {
    render(<GradientCard>Contenido del panel</GradientCard>);
    const text = screen.getByText("Contenido del panel");
    expect(text.parentElement).not.toBeNull();
    expect(text.parentElement?.parentElement).not.toBeNull();
  });

  it("permite usar un elemento semántico como contenedor", () => {
    const { container } = render(
      <GradientCard as="section">Contenido</GradientCard>,
    );
    expect(container.firstElementChild?.tagName).toBe("SECTION");
  });
});
