// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JuryResult } from "../api/client";
import type { ScoreValue } from "../criteria";
import { useDraft } from "./useDraft";

afterEach(cleanup);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useDraft", () => {
  it("recupera el borrador guardado en el servidor al montar", () => {
    const serverNotes: Record<string, ScoreValue> = { "1": 4, "3": 5 };
    const { result } = renderHook(() =>
      useDraft({
        roundId: "1",
        serverNotes,
        saveNote: vi.fn(),
        onSessionExpired: vi.fn(),
      }),
    );

    expect(result.current.scores).toEqual({ "1": 4, "3": 5 });
    expect(result.current.hasRecoveredDraft).toBe(true);
    expect(result.current.status).toBe("idle");
  });

  it("actualiza de forma optimista y marca el borrador como guardado al confirmar el servidor", async () => {
    const saveNote = vi.fn().mockResolvedValue({ ok: true, value: null });
    const { result } = renderHook(() =>
      useDraft({
        roundId: "1",
        serverNotes: {},
        saveNote,
        onSessionExpired: vi.fn(),
      }),
    );

    act(() => result.current.setScore("1", 4));
    expect(result.current.scores["1"]).toBe(4);
    expect(result.current.status).toBe("saving");

    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(saveNote).toHaveBeenCalledWith("1", 4);
  });

  it("ignora respuestas desordenadas de ediciones rápidas en el mismo criterio", async () => {
    const first = deferred<JuryResult>();
    const second = deferred<JuryResult>();
    const saveNote = vi
      .fn<(_c: string, _v: ScoreValue) => Promise<JuryResult>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() =>
      useDraft({
        roundId: "1",
        serverNotes: {},
        saveNote,
        onSessionExpired: vi.fn(),
      }),
    );

    act(() => result.current.setScore("1", 2));
    act(() => result.current.setScore("1", 5));
    expect(result.current.scores["1"]).toBe(5);

    await act(async () => {
      second.resolve({ ok: true, value: null });
      await second.promise;
    });
    expect(result.current.scores["1"]).toBe(5);
    expect(result.current.status).toBe("saving");

    await act(async () => {
      first.resolve({ ok: false, sessionExpired: false, message: "Error viejo" });
      await first.promise;
    });
    expect(result.current.scores["1"]).toBe(5);
    expect(result.current.errorMessage).toBeNull();
  });

  it("revierte la nota local y muestra el mensaje si el servidor rechaza el borrador", async () => {
    const saveNote = vi.fn().mockResolvedValue({
      ok: false,
      sessionExpired: false,
      message: "Ya enviaste tus notas.",
    });

    const { result } = renderHook(() =>
      useDraft({
        roundId: "1",
        serverNotes: { "2": 3 },
        saveNote,
        onSessionExpired: vi.fn(),
      }),
    );

    act(() => result.current.setScore("2", 5));
    expect(result.current.scores["2"]).toBe(5);

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.scores["2"]).toBe(3);
    expect(result.current.errorMessage).toBe("Ya enviaste tus notas.");
  });

  it("notifica expiración de sesión cuando el guardado responde 401", async () => {
    const onSessionExpired = vi.fn();
    const saveNote = vi.fn().mockResolvedValue({
      ok: false,
      sessionExpired: true,
      message: "Tu sesión venció.",
    });

    const { result } = renderHook(() =>
      useDraft({
        roundId: "1",
        serverNotes: {},
        saveNote,
        onSessionExpired,
      }),
    );

    act(() => result.current.setScore("1", 4));

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledWith("Tu sesión venció."));
  });

  it("reinicia los cambios locales al cambiar de ronda", async () => {
    const saveNote = vi.fn().mockResolvedValue({ ok: true, value: null });
    const { result, rerender } = renderHook(
      ({ roundId, serverNotes }) =>
        useDraft({
          roundId,
          serverNotes,
          saveNote,
          onSessionExpired: vi.fn(),
        }),
      { initialProps: { roundId: "1", serverNotes: {} as Record<string, ScoreValue> } },
    );

    act(() => result.current.setScore("1", 4));
    await waitFor(() => expect(result.current.status).toBe("saved"));

    rerender({ roundId: "2", serverNotes: { "1": 2 } });

    expect(result.current.scores).toEqual({ "1": 2 });
    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
  });
});
