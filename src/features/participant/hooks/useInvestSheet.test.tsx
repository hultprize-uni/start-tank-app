// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import { useInvestSheet } from "./useInvestSheet";

afterEach(cleanup);

describe("useInvestSheet", () => {
  it("abre la hoja para la ronda vigente y la cierra", () => {
    const { result } = renderHook(() => useInvestSheet(2, true));

    expect(result.current.isOpen).toBe(false);

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it("no reabre la hoja en la ronda siguiente", () => {
    const { result, rerender } = renderHook(
      ({ round }: { round: number }) => useInvestSheet(round, true),
      { initialProps: { round: 2 } },
    );

    act(() => result.current.open());
    rerender({ round: 3 });

    expect(result.current.isOpen).toBe(false);
  });

  it("oculta la hoja cuando el mercado deja de admitir inversiones", () => {
    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) => useInvestSheet(2, open),
      { initialProps: { open: true } },
    );

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);

    rerender({ open: false });
    expect(result.current.isOpen).toBe(false);
  });
});
