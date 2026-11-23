import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { USE_MOCKS } from "@/shared/lib/env";
import type { Decision } from "@/shared/domain/types";
import { JURY_CRITERIA } from "../criteria";
import { readJuryState, loginJury, logoutJury, voteJury } from "../api/client";
import { useJuryStateMock } from "../api/mock";
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

/** Estado antes del ingreso: pantalla de acceso con código. */
export const INITIAL_JURY_STATE: JuryViewModel = {
  screen: "access",
  phase: null,
  clock: null,
  access: INITIAL_ACCESS,
  jurorLabel: null,
  round: null,
  rail: [],
  criteria: JURY_CRITERIA,
  vote: INITIAL_VOTE,
  votes: { emitted: 0, total: 0 },
  ownVote: null,
  reveal: null,
};

/**
 * Combina el estado recibido del servidor con los datos locales del voto. El borrador y la
 * confirmación solo se conservan mientras la ronda siga en votación.
 */
export function mergeJuryState(prev: JuryViewModel, view: JuryViewModel): JuryViewModel {
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
export function useJuryStateApi(): { state: JuryViewModel; actions: JuryActions } {
  const [state, setState] = useState<JuryViewModel>(INITIAL_JURY_STATE);
  const [sessionActive, setSessionActive] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const endSession = useCallback((message: string) => {
    setSessionActive(false);
    setState({ ...INITIAL_JURY_STATE, access: { status: "idle", errorMessage: message } });
  }, []);

  const refresh = useCallback(async () => {
    const result = await readJuryState();
    if (result.ok) {
      setState((prev) => mergeJuryState(prev, result.value));
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

  /*
   * Al montar, consulta el estado para restaurar una sesión vigente (por ejemplo tras recargar la
   * página). Si la lectura falla, el portal permanece en el acceso por código.
   */
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await readJuryState();
      if (!active || !result.ok) return;
      setState((prev) => mergeJuryState(prev, result.value));
      setSessionActive(true);
    })();
    return () => {
      active = false;
    };
  }, []);

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
        setState((prev) => ({
          ...prev,
          screen: "vote_registered",
          ownVote: decision,
          vote: INITIAL_VOTE,
        }));
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

  const logout = useCallback(() => {
    setSessionActive(false);
    void (async () => {
      await logoutJury();
      setState({ ...INITIAL_JURY_STATE });
    })();
  }, []);

  return useMemo(
    () => ({
      state,
      actions: {
        submitCode,
        selectDecision,
        requestConfirm,
        cancelConfirm,
        confirmVote,
        logout,
      },
    }),
    [state, submitCode, selectDecision, requestConfirm, cancelConfirm, confirmVote, logout],
  );
}

/**
 * Estado del portal del jurado. Usa los datos de muestra solo con NEXT_PUBLIC_USE_MOCKS=true; en
 * otro caso consume la API. La selección ocurre en tiempo de compilación.
 */
export const useJuryState: () => { state: JuryViewModel; actions: JuryActions } = USE_MOCKS
  ? useJuryStateMock
  : useJuryStateApi;
