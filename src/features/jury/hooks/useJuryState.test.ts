// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

afterEach(cleanup);
import { loginJury, readJuryState, voteJury } from "../api/client";
import { MOCK_CODE_ERROR, MOCK_TIMELINE, useJuryStateMock } from "../api/mock";
import type { JuryViewModel } from "../types";
import { INITIAL_JURY_STATE, mergeJuryState, useJuryStateApi } from "./useJuryState";

vi.mock("../api/client", () => ({
  loginJury: vi.fn(),
  readJuryState: vi.fn(),
  voteJury: vi.fn(),
}));

/** Vista del servidor con el jurado en votación y sin voto propio. */
const VOTING_VIEW: JuryViewModel = {
  ...INITIAL_JURY_STATE,
  screen: "voting",
  phase: "voting",
  jurorLabel: "Jurado 2",
  round: { number: 1, total: 5, startupName: "AgroSense", sdg: "ODS 2", description: null },
  votes: { emitted: 1, total: 4 },
};

beforeEach(() => {
  vi.mocked(loginJury).mockReset();
  vi.mocked(readJuryState).mockReset();
  vi.mocked(voteJury).mockReset();
  // Por defecto, el estado responde 401: no hay sesión vigente al montar.
  vi.mocked(readJuryState).mockResolvedValue({
    ok: false,
    sessionExpired: true,
    message: "Tu sesión venció. Ingresa tu código de nuevo.",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("mergeJuryState", () => {
  it("conserva el borrador mientras la ronda sigue en votación", () => {
    const prev: JuryViewModel = {
      ...VOTING_VIEW,
      vote: { draft: "BACK", confirming: true, submitting: false, errorMessage: null },
    };
    expect(mergeJuryState(prev, VOTING_VIEW).vote.draft).toBe("BACK");
  });

  it("descarta el borrador cuando la fase cambia", () => {
    const prev: JuryViewModel = {
      ...VOTING_VIEW,
      vote: { draft: "BACK", confirming: false, submitting: false, errorMessage: null },
    };
    const result = mergeJuryState(prev, { ...VOTING_VIEW, screen: "result", phase: "result" });
    expect(result.vote.draft).toBeNull();
  });
});

describe("useJuryStateApi", () => {
  it("restaura la sesión vigente al montar, sin pedir el código de nuevo", async () => {
    vi.mocked(readJuryState).mockResolvedValue({ ok: true, value: VOTING_VIEW });
    const { result } = renderHook(() => useJuryStateApi());

    await waitFor(() => expect(result.current.state.jurorLabel).toBe("Jurado 2"));
    expect(result.current.state.screen).toBe("voting");
    expect(loginJury).not.toHaveBeenCalled();
  });

  it("muestra el acceso sin mensaje de error cuando no hay sesión al montar", async () => {
    const { result } = renderHook(() => useJuryStateApi());

    await waitFor(() => expect(readJuryState).toHaveBeenCalledTimes(1));
    expect(result.current.state.jurorLabel).toBeNull();
    expect(result.current.state.access).toEqual({ status: "idle", errorMessage: null });
  });

  it("pasa del acceso a la sesión tras validar el código", async () => {
    vi.mocked(loginJury).mockResolvedValue({ ok: true, value: null });
    vi.mocked(readJuryState).mockResolvedValue({ ok: true, value: VOTING_VIEW });
    const { result } = renderHook(() => useJuryStateApi());

    act(() => result.current.actions.submitCode("JUR-2"));

    await waitFor(() => expect(result.current.state.jurorLabel).toBe("Jurado 2"));
    expect(loginJury).toHaveBeenCalledWith("JUR-2");
  });

  it("muestra el error de acceso sin abrir la sesión", async () => {
    vi.mocked(loginJury).mockResolvedValue({
      ok: false,
      sessionExpired: false,
      message: "El código no es válido.",
    });
    const { result } = renderHook(() => useJuryStateApi());

    act(() => result.current.actions.submitCode("0000"));

    await waitFor(() =>
      expect(result.current.state.access).toEqual({
        status: "error",
        errorMessage: "El código no es válido.",
      }),
    );
    expect(result.current.state.jurorLabel).toBeNull();
  });

  it("devuelve al acceso cuando la sesión vence durante la lectura", async () => {
    vi.mocked(loginJury).mockResolvedValue({ ok: true, value: null });
    vi.mocked(readJuryState).mockResolvedValue({
      ok: false,
      sessionExpired: true,
      message: "Tu sesión venció.",
    });
    const { result } = renderHook(() => useJuryStateApi());

    act(() => result.current.actions.submitCode("JUR-2"));

    await waitFor(() => expect(result.current.state.access.errorMessage).toBe("Tu sesión venció."));
    expect(result.current.state.jurorLabel).toBeNull();
  });

  it("registra el voto confirmado y actualiza la pantalla", async () => {
    vi.mocked(loginJury).mockResolvedValue({ ok: true, value: null });
    vi.mocked(readJuryState).mockResolvedValue({ ok: true, value: VOTING_VIEW });
    vi.mocked(voteJury).mockResolvedValue({ ok: true, value: null });
    const { result } = renderHook(() => useJuryStateApi());
    act(() => result.current.actions.submitCode("JUR-2"));
    await waitFor(() => expect(result.current.state.jurorLabel).toBe("Jurado 2"));

    act(() => result.current.actions.selectDecision("BACK"));
    act(() => result.current.actions.requestConfirm());
    expect(result.current.state.vote.confirming).toBe(true);
    vi.mocked(readJuryState).mockResolvedValue({
      ok: true,
      value: { ...VOTING_VIEW, screen: "vote_registered", ownVote: "BACK" },
    });
    act(() => result.current.actions.confirmVote());

    expect(voteJury).toHaveBeenCalledWith("BACK");
    await waitFor(() => expect(result.current.state.screen).toBe("vote_registered"));
    expect(result.current.state.ownVote).toBe("BACK");
  });

  it("conserva el error del voto rechazado y permite reintentar", async () => {
    vi.mocked(loginJury).mockResolvedValue({ ok: true, value: null });
    vi.mocked(readJuryState).mockResolvedValue({ ok: true, value: VOTING_VIEW });
    vi.mocked(voteJury).mockResolvedValue({
      ok: false,
      sessionExpired: false,
      message: "La votación ya cerró.",
    });
    const { result } = renderHook(() => useJuryStateApi());
    act(() => result.current.actions.submitCode("JUR-2"));
    await waitFor(() => expect(result.current.state.jurorLabel).toBe("Jurado 2"));

    act(() => result.current.actions.selectDecision("REJECT"));
    act(() => result.current.actions.requestConfirm());
    act(() => result.current.actions.confirmVote());

    await waitFor(() =>
      expect(result.current.state.vote.errorMessage).toBe("La votación ya cerró."),
    );
    expect(result.current.state.vote).toMatchObject({
      draft: "REJECT",
      confirming: false,
      submitting: false,
      errorMessage: "La votación ya cerró.",
    });
  });
});

describe("useJuryStateMock", () => {
  it("rechaza un código simulado inválido tras el retardo de validación", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useJuryStateMock());

    act(() => result.current.actions.submitCode("JUR-9"));
    expect(result.current.state.access.status).toBe("validating");
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.state.access.errorMessage).toBe(MOCK_CODE_ERROR);
    expect(result.current.state.jurorLabel).toBeNull();
  });

  it("recorre la votación simulada hasta registrar el voto del jurado", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useJuryStateMock());
    act(() => result.current.actions.submitCode("JUR-3"));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.state.jurorLabel).toBe("Jurado 3");

    const votingStart = MOCK_TIMELINE.findIndex((step) => step.phase === "voting");
    for (const step of MOCK_TIMELINE.slice(0, votingStart)) {
      act(() => {
        vi.advanceTimersByTime(step.duration);
      });
    }
    expect(result.current.state.screen).toBe("voting");

    act(() => result.current.actions.selectDecision("BACK"));
    act(() => result.current.actions.requestConfirm());
    act(() => result.current.actions.confirmVote());
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.state.screen).toBe("vote_registered");
    expect(result.current.state.ownVote).toBe("BACK");
  });
});
