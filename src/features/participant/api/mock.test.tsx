// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useParticipantMockState } from "./mock";

afterEach(cleanup);

/** Milisegundos hasta que la simulación pasa de la fase programada a la ronda abierta. */
const SCHEDULED_MS = 8_000;

afterEach(() => {
  vi.useRealTimers();
});

describe("useParticipantMockState", () => {
  it("rechaza montos bajo el mínimo y acepta un monto válido durante el mercado abierto", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useParticipantMockState());

    act(() => vi.advanceTimersByTime(SCHEDULED_MS));
    expect(result.current.vm?.phase).toBe("open");

    const rejected = await act(() => result.current.actions.invest(100));
    expect(rejected).toEqual({ ok: false, message: "El mínimo es 250 coins." });

    const accepted = await act(() => result.current.actions.invest(250));
    expect(accepted).toEqual({ ok: true });
    expect(result.current.vm?.wallet?.investedInRound).toBe(250);
    expect(result.current.vm?.wallet?.balance).toBe(9_750);
  });

  it("rechaza inversiones que superan el tope de la ronda", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useParticipantMockState());

    act(() => vi.advanceTimersByTime(SCHEDULED_MS));

    const overCap = await act(() => result.current.actions.invest(3_001));
    expect(overCap).toEqual({ ok: false, message: "Tu tope en esta ronda es 3,000." });
  });
});
