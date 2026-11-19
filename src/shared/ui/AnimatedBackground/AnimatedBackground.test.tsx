// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedBackground } from "./AnimatedBackground";

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

afterEach(() => {
  cleanup();
  // @ts-expect-error jsdom no define matchMedia por defecto; se restablece tras cada prueba.
  delete window.matchMedia;
});

describe("AnimatedBackground", () => {
  it("es decorativo y se oculta de las tecnologías de apoyo", () => {
    mockReducedMotion(false);
    const { container } = render(<AnimatedBackground />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("renderiza las burbujas cuando no hay preferencia de movimiento reducido", () => {
    mockReducedMotion(false);
    const { container } = render(<AnimatedBackground />);
    expect(container.querySelectorAll("i")).toHaveLength(10);
    expect(container.firstElementChild).not.toHaveAttribute(
      "data-reduced-motion",
    );
  });

  it("detiene las animaciones y omite las burbujas con movimiento reducido", () => {
    mockReducedMotion(true);
    const { container } = render(<AnimatedBackground />);
    expect(container.querySelectorAll("i")).toHaveLength(0);
    expect(container.firstElementChild).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
  });

  it("aplica la posición absoluta cuando fixed es falso", () => {
    mockReducedMotion(false);
    const { container } = render(<AnimatedBackground fixed={false} />);
    expect(container.firstElementChild?.className).toContain("absolute");
  });
});
