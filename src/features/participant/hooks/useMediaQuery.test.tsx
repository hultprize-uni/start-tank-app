// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_QUERY, useMediaQuery } from "./useMediaQuery";

afterEach(cleanup);

type Listener = (event: { matches: boolean }) => void;

/** Simula matchMedia con una consulta cuyo resultado puede cambiarse desde la prueba. */
function stubMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }));
  return {
    change(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener({ matches: next }));
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("devuelve el valor de la consulta y lo actualiza al cambiar el ancho", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery(DESKTOP_QUERY));

    expect(result.current).toBe(false);

    act(() => media.change(true));

    expect(result.current).toBe(true);
  });

  it("considera móvil el diseño cuando matchMedia no está disponible", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useMediaQuery(DESKTOP_QUERY));

    expect(result.current).toBe(false);
  });
});
