// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Eyebrow } from "./Eyebrow";

afterEach(cleanup);

describe("Eyebrow", () => {
  it("renderiza un párrafo por defecto con el texto recibido", () => {
    render(<Eyebrow>Shark Tank Universitario</Eyebrow>);
    const element = screen.getByText("Shark Tank Universitario");
    expect(element.tagName).toBe("P");
  });

  it("permite cambiar el elemento HTML renderizado", () => {
    render(<Eyebrow as="span">Ronda 3</Eyebrow>);
    expect(screen.getByText("Ronda 3").tagName).toBe("SPAN");
  });
});
