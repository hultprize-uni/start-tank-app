// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn((_type: string, listener: () => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: () => void) => {
      listeners.delete(listener);
    }),
  };
  window.matchMedia = vi.fn().mockReturnValue(query);
  return query;
}

afterEach(() => {
  cleanup();
  // @ts-expect-error jsdom no define matchMedia por defecto; se restablece tras cada prueba.
  delete window.matchMedia;
});

describe("usePrefersReducedMotion", () => {
  it("devuelve verdadero cuando el sistema solicita movimiento reducido", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("devuelve falso cuando no hay preferencia de movimiento reducido", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("devuelve falso cuando el navegador no implementa matchMedia", () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
