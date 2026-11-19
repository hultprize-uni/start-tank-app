// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePortalToast } from "./usePortalToast";

afterEach(() => {
  vi.useRealTimers();
});

describe("usePortalToast", () => {
  it("muestra el aviso con su tono y lo retira al cabo del tiempo indicado", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePortalToast(1_000));

    expect(result.current.toast).toBeNull();

    act(() => result.current.showToast("Inversión confirmada", "positive"));
    expect(result.current.toast).toEqual({ message: "Inversión confirmada", tone: "positive" });

    act(() => vi.advanceTimersByTime(999));
    expect(result.current.toast).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it("reinicia el tiempo de vida cuando llega un aviso nuevo", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePortalToast(1_000));

    act(() => result.current.showToast("Primero"));
    act(() => vi.advanceTimersByTime(800));
    act(() => result.current.showToast("Segundo", "negative"));
    act(() => vi.advanceTimersByTime(800));

    expect(result.current.toast).toEqual({ message: "Segundo", tone: "negative" });
  });
});
