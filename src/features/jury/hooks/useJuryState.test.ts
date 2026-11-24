// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

afterEach(cleanup);
import {
  loginJury,
  logoutJury,
  readJuryState,
  saveJuryDraft,
  submitJuryVote,
} from "../api/client";
import { MOCK_CODE_ERROR, MOCK_TIMELINE, useJuryStateMock } from "../api/mock";
import type { JuryViewModel } from "../types";
import { INITIAL_JURY_STATE, mergeJuryState, useJuryStateApi } from "./useJuryState";

vi.mock("../api/client", () => ({
  loginJury: vi.fn(),
  logoutJury: vi.fn(),
  readJuryState: vi.fn(),
  saveJuryDraft: vi.fn(),
  submitJuryVote: vi.fn(),
}));

/** Vista del servidor con el jurado en votación y sin envío propio. */
const VOTING_VIEW: JuryViewModel = {
  ...INITIAL_JURY_STATE,
  screen: "grading",
  phase: "voting",
  jurorLabel: "Jurado 2",
  round: {
    id: "1",
    number: 1,
    total: 5,
    startupName: "AgroSense",
    sdg: "ODS 2",
    description: null,
    logoUrl: null,
  },
  votes: { emitted: 1, total: 4 },
};

beforeEach(() => {
  vi.mocked(loginJury).mockReset();
  vi.mocked(logoutJury).mockReset();
  vi.mocked(readJuryState).mockReset();
  vi.mocked(saveJuryDraft).mockReset();
  vi.mocked(submitJuryVote).mockReset();
  vi.mocked(saveJuryDraft).mockResolvedValue({ ok: true, value: null });
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
  it("conserva el diálogo abierto mientras la ronda sigue en calificación", () => {
    const prev: JuryViewModel = {
      ...VOTING_VIEW,
      vote: { sheet: "confirm_send", submitting: false, errorMessage: null },
    };
    expect(mergeJuryState(prev, VOTING_VIEW).vote.sheet).toBe("confirm_send");
  });

  it("cierra los diálogos cuando la ronda pasa a resultado", () => {
    const prev: JuryViewModel = {
      ...VOTING_VIEW,
      vote: { sheet: "confirm_send", submitting: false, errorMessage: null },
    };
    const result = mergeJuryState(prev, { ...VOTING_VIEW, screen: "result", phase: "result" });
    expect(result.vote.sheet).toBeNull();
  });
});

describe("useJuryStateApi", () => {
  it("restaura la sesión vigente y el borrador al montar sin pedir el código de nuevo", async () => {
    vi.mocked(readJuryState).mockResolvedValue({
      ok: true,
      value: { ...VOTING_VIEW, draftNotes: { "1": 4, "2": 5 } },
    });
    const { result } = renderHook(() => useJuryStateApi());

    await waitFor(() => expect(result.current.state.jurorLabel).toBe("Jurado 2"));
    expect(result.current.state.screen).toBe("grading");
    expect(result.current.state.draftNotes).toEqual({ "1": 4, "2": 5 });
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
      message: "Ese código no existe.",
    });
    const { result } = renderHook(() => useJuryStateApi());

    act(() => result.current.actions.submitCode("0000"));

    await waitFor(() =>
      expect(result.current.state.access).toEqual({
        status: "error",
        errorMessage: "Ese código no existe.",
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

  it("guarda el borrador de cada criterio y envía las cuatro notas confirmadas", async () => {
    vi.mocked(loginJury).mockResolvedValue({ ok: true, value: null });
    vi.mocked(readJuryState).mockResolvedValue({ ok: true, value: VOTING_VIEW });
    vi.mocked(submitJuryVote).mockResolvedValue({ ok: true, value: { score: 4.25 } });
    const { result } = renderHook(() => useJuryStateApi());
    act(() => result.current.actions.submitCode("JUR-2"));
    await waitFor(() => expect(result.current.state.jurorLabel).toBe("Jurado 2"));

    act(() => {
      result.current.actions.setScore("1", 5);
      result.current.actions.setScore("2", 4);
      result.current.actions.setScore("3", 4);
      result.current.actions.setScore("4", 4);
    });
    await waitFor(() => expect(saveJuryDraft).toHaveBeenCalledTimes(4));

    act(() => result.current.actions.openConfirmSend());
    expect(result.current.state.vote.sheet).toBe("confirm_send");

    vi.mocked(readJuryState).mockResolvedValue({
      ok: true,
      value: {
        ...VOTING_VIEW,
        screen: "vote_registered",
        ownVerdict: { abstained: false, score: 4.25, notes: { "1": 5, "2": 4, "3": 4, "4": 4 } },
      },
    });
    act(() => result.current.actions.confirmSend());

    expect(submitJuryVote).toHaveBeenCalledWith({
      abstain: false,
      notes: [
        { criterionId: "1", value: 5 },
        { criterionId: "2", value: 4 },
        { criterionId: "3", value: 4 },
        { criterionId: "4", value: 4 },
      ],
    });
    await waitFor(() => expect(result.current.state.screen).toBe("vote_registered"));
    expect(result.current.state.ownVerdict?.score).toBe(4.25);
  });

  it("registra la abstención por conflicto de interés sin enviar motivo", async () => {
    vi.mocked(loginJury).mockResolvedValue({ ok: true, value: null });
    vi.mocked(readJuryState).mockResolvedValue({ ok: true, value: VOTING_VIEW });
    vi.mocked(submitJuryVote).mockResolvedValue({ ok: true, value: { score: null } });
    const { result } = renderHook(() => useJuryStateApi());
    act(() => result.current.actions.submitCode("JUR-2"));
    await waitFor(() => expect(result.current.state.jurorLabel).toBe("Jurado 2"));

    act(() => result.current.actions.openAbstain());
    expect(result.current.state.vote.sheet).toBe("abstain");

    vi.mocked(readJuryState).mockResolvedValue({
      ok: true,
      value: {
        ...VOTING_VIEW,
        screen: "vote_registered",
        ownVerdict: { abstained: true, score: null, notes: {} },
      },
    });
    act(() => result.current.actions.confirmAbstain());

    expect(submitJuryVote).toHaveBeenCalledWith({ abstain: true });
    await waitFor(() => expect(result.current.state.screen).toBe("vote_registered"));
    expect(result.current.state.ownVerdict?.abstained).toBe(true);
  });

  it("conserva el error del envío rechazado y permite reintentar", async () => {
    vi.mocked(loginJury).mockResolvedValue({ ok: true, value: null });
    vi.mocked(readJuryState).mockResolvedValue({ ok: true, value: VOTING_VIEW });
    vi.mocked(submitJuryVote).mockResolvedValue({
      ok: false,
      sessionExpired: false,
      message: "La votación ya cerró.",
    });
    const { result } = renderHook(() => useJuryStateApi());
    act(() => result.current.actions.submitCode("JUR-2"));
    await waitFor(() => expect(result.current.state.jurorLabel).toBe("Jurado 2"));

    act(() => result.current.actions.confirmAbstain());

    await waitFor(() =>
      expect(result.current.state.vote.errorMessage).toBe("La votación ya cerró."),
    );
    expect(result.current.state.vote).toMatchObject({
      sheet: null,
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

  it("recorre la calificación simulada desde borrador hasta el envío definitivo", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useJuryStateMock());
    act(() => result.current.actions.submitCode("JUR-3"));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.state.jurorLabel).toBe("Jurado 3");

    const openStart = MOCK_TIMELINE.findIndex((step) => step.phase === "open");
    for (const step of MOCK_TIMELINE.slice(0, openStart)) {
      act(() => {
        vi.advanceTimersByTime(step.duration);
      });
    }
    expect(result.current.state.screen).toBe("grading");

    act(() => {
      result.current.actions.setScore("1", 4);
      result.current.actions.setScore("2", 5);
      result.current.actions.setScore("3", 4);
      result.current.actions.setScore("4", 3);
    });

    const votingStart = MOCK_TIMELINE.findIndex((step) => step.phase === "voting");
    for (const step of MOCK_TIMELINE.slice(openStart, votingStart)) {
      act(() => {
        vi.advanceTimersByTime(step.duration);
      });
    }
    expect(result.current.state.draftNotes).toEqual({ "1": 4, "2": 5, "3": 4, "4": 3 });

    act(() => result.current.actions.openConfirmSend());
    act(() => result.current.actions.confirmSend());
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.state.screen).toBe("vote_registered");
    expect(result.current.state.ownVerdict).toEqual({
      abstained: false,
      score: 4,
      notes: { "1": 4, "2": 5, "3": 4, "4": 3 },
    });
  });
});
