// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSessionRestore } from "./useSessionRestore";

describe("useSessionRestore", () => {
  it("entra directo a la consola cuando la sesión sigue válida", async () => {
    const check = vi.fn(async () => true);
    const { result } = renderHook(() => useSessionRestore(check));

    expect(result.current.status).toBe("checking");
    await waitFor(() => expect(result.current.status).toBe("authorized"));
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("muestra el acceso por código cuando la sesión no es válida", async () => {
    const check = vi.fn(async () => false);
    const { result } = renderHook(() => useSessionRestore(check));

    await waitFor(() => expect(result.current.status).toBe("anonymous"));
  });

  it("muestra el acceso si la comprobación falla por error de red", async () => {
    const check = vi.fn(async () => {
      throw new Error("offline");
    });
    const { result } = renderHook(() => useSessionRestore(check));

    await waitFor(() => expect(result.current.status).toBe("anonymous"));
  });

  it("permite cambiar la situación tras un acceso o al cerrar sesión", async () => {
    const check = vi.fn(async () => false);
    const { result } = renderHook(() => useSessionRestore(check));
    await waitFor(() => expect(result.current.status).toBe("anonymous"));

    act(() => result.current.setStatus("authorized"));
    expect(result.current.status).toBe("authorized");
  });
});
