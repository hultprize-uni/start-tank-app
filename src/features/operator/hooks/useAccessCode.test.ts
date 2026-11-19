// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAccessCode } from "./useAccessCode";

describe("useAccessCode", () => {
  it("no permite enviar un código vacío", async () => {
    const validate = vi.fn(async () => null);
    const { result } = renderHook(() => useAccessCode(validate));

    expect(result.current.canSubmit).toBe(false);
    await act(() => result.current.submit());
    expect(validate).not.toHaveBeenCalled();
  });

  it("expone el mensaje de error devuelto por la validación y lo borra al editar", async () => {
    const validate = vi.fn(async () => "Código no válido.");
    const { result } = renderHook(() => useAccessCode(validate));

    act(() => result.current.changeCode("ABC"));
    await act(() => result.current.submit());

    await waitFor(() => expect(result.current.error).toBe("Código no válido."));
    expect(validate).toHaveBeenCalledWith("ABC");

    act(() => result.current.changeCode("ABCD"));
    expect(result.current.error).toBeNull();
  });
});
