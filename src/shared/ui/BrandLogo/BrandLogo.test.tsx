// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrandLogo } from "./BrandLogo";

afterEach(cleanup);

describe("BrandLogo", () => {
  it("usa el nombre de la marca como texto alternativo por defecto", () => {
    render(<BrandLogo />);
    expect(screen.getByRole("img", { name: "Start Tank" })).toBeInTheDocument();
  });

  it("acepta un texto alternativo configurable", () => {
    render(<BrandLogo alt="Inicio de Start Tank" />);
    expect(
      screen.getByRole("img", { name: "Inicio de Start Tank" }),
    ).toBeInTheDocument();
  });

  it("carga la versión horizontal o vertical según la variante", () => {
    const { rerender } = render(<BrandLogo variant="horizontal" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("logo-start-tank-horizontal.png"),
    );

    rerender(<BrandLogo variant="vertical" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      expect.stringContaining("logo-start-tank-vertical.png"),
    );
  });
});
