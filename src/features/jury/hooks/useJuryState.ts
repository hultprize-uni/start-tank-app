import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { USE_MOCKS } from "@/shared/lib/env";
import type { Decision } from "@/shared/domain/types";
import { readJuryState, loginJury, voteJury } from "../api/client";
import { useJuryState as useJuryStateMock } from "../api/mock";
import type { JuryAccessView, JuryActions, JuryViewModel, JuryVoteView } from "../types";

/** Periodo del sondeo del estado del jurado, en milisegundos. */
export const JURY_POLL_INTERVAL_MS = 3_000;

const INITIAL_ACCESS: JuryAccessView = { status: "idle", errorMessage: null };

const INITIAL_VOTE: JuryVoteView = {
  draft: null,
  confirming: false,
  submitting: false,
  errorMessage: null,
};

const INITIAL_STATE: JuryViewModel = {
  screen: "access",
  access: INITIAL_ACCESS,
  jurorLabel: null,
  round: null,
  criteria: [],
  vote: INITIAL_VOTE,
  votes: { emitted: 0, total: 0 },
};

/**
 * Combina el estado recibido del servidor con los datos locales del voto. El borrador y la
 * confirmación solo se conservan mientras la ronda siga en votación.
 */
function mergeState(prev: JuryViewModel, view: JuryViewModel): JuryViewModel {
  const sameVoting = prev.screen === "voting" && view.screen === "voting";
  return {
    ...view,
    access: INITIAL_ACCESS,
    vote: sameVoting ? prev.vote : INITIAL_VOTE,
  };
}

/**
 * Estado del portal del jurado conectado a la API. Tras el acceso con código, sondea el estado
 * cada JURY_POLL_INTERVAL_MS y devuelve al acceso cuando la sesión deja de ser válida.
 */
function useJuryStateApi(): { state: JuryViewModel; actions: JuryActions } {
  const [state, setState] = useState<JuryViewModel>(INITIAL_STATE);
  const [sessionActive, setSessionActive] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const endSession = useCallback((message: string) => {
    setSessionActive(false);
    setState({ ...INITIAL_STATE, access: { status: "idle", errorMessage: message } });
  }, []);

  const refresh = useCallback(async () => {
    const result = await readJuryState();
    if (result.ok) {
      setState((prev) => mergeState(prev, result.value));
    } else if (result.sessionExpired) {
      endSession(result.message);
    }
  }, [endSession]);

  useEffect(() => {
    if (!sessionActive) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), JURY_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [sessionActive, refresh]);

  const submitCode = useCallback((code: string) => {
    setState((prev) => ({ ...prev, access: { status: "validating", errorMessage: null } }));
    void (async () => {
      const result = await loginJury(code);
      if (!result.ok) {
        setState((prev) => ({
          ...prev,
          access: { status: "error", errorMessage: result.message },
        }));
        return;
      }
      setState((prev) => ({ ...prev, access: INITIAL_ACCESS }));
      setSessionActive(true);
    })();
  }, []);

  const selectDecision = useCallback((decision: Decision) => {
    setState((prev) => ({
      ...prev,
      vote: { ...prev.vote, draft: decision, confirming: false, errorMessage: null },
    }));
  }, []);

  const requestConfirm = useCallback(() => {
    setState((prev) => {
      if (prev.vote.draft === null) return prev;
      return { ...prev, vote: { ...prev.vote, confirming: true } };
    });
  }, []);

  const cancelConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, vote: { ...prev.vote, confirming: false } }));
  }, []);

  const confirmVote = useCallback(() => {
    const decision = stateRef.current.vote.draft;
    if (decision === null) return;

    setState((prev) => ({
      ...prev,
      vote: { ...prev.vote, submitting: true, errorMessage: null },
    }));
    void (async () => {
      const result = await voteJury(decision);
      if (result.ok) {
        setState((prev) => ({ ...prev, screen: "vote_registered", vote: INITIAL_VOTE }));
        await refresh();
        return;
      }
      if (result.sessionExpired) {
        endSession(result.message);
        return;
      }
      setState((prev) => ({
        ...prev,
        vote: {
          draft: prev.vote.draft,
          confirming: false,
          submitting: false,
          errorMessage: result.message,
        },
      }));
      await refresh();
    })();
  }, [refresh, endSession]);

  return useMemo(
    () => ({
      state,
      actions: {
        submitCode,
        selectDecision,
        requestConfirm,
        cancelConfirm,
        confirmVote,
      },
    }),
    [state, submitCode, selectDecision, requestConfirm, cancelConfirm, confirmVote],
  );
}

/**
 * Estado del portal del jurado. Usa los datos de muestra solo con NEXT_PUBLIC_USE_MOCKS=true; en
 * otro caso consume la API. La selección ocurre en tiempo de compilación.
 */
export const useJuryState: () => { state: JuryViewModel; actions: JuryActions } = USE_MOCKS
  ? useJuryStateMock
  : useJuryStateApi;
