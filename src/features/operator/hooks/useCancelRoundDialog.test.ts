// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCancelRoundDialog } from "./useCancelRoundDialog";

describe("useCancelRoundDialog", () => {
  it("inicia en el paso de elección sin modo seleccionado", () => {
    const { result } = renderHook(() => useCancelRoundDialog());

    expect(result.current.step).toBe("choose");
    expect(result.current.mode).toBeNull();
  });

  it("avanza a la confirmación con el modo elegido y regresa descartándolo", () => {
    const { result } = renderHook(() => useCancelRoundDialog());

    act(() => result.current.choose("refund"));
    expect(result.current.step).toBe("confirm");
    expect(result.current.mode).toBe("refund");

    act(() => result.current.back());
    expect(result.current.step).toBe("choose");
    expect(result.current.mode).toBeNull();
  });
});
