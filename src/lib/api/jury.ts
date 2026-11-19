import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Decision } from "@/shared/domain/types";
import type {
  JuryAccessView,
  JuryActions,
  JuryViewModel,
  JuryVoteView,
} from "@/lib/api/jury.types";

import { SERVER_ERROR_MESSAGE, OFFLINE_MESSAGE, requestJson } from "./http";
import { USE_MOCKS } from "./entorno";
import { useJuryState as useJuryStateMock } from "./jury.mock";

/** Periodo del sondeo del estado del jurado, en milisegundos. */
export const JURY_POLL_INTERVAL_MS = 3_000;

/** Mensaje cuando la sesión del jurado ha dejado de ser válida. */
export const JURY_SESSION_EXPIRED_MESSAGE = "Tu sesión venció. Ingresa tu código de nuevo.";

const LOGIN_MESSAGES: Readonly<Record<string, string>> = {
  CODE_REQUIRED: "Ingresa tu código de acceso.",
  INVALID_CODE: "El código no es válido. Revísalo e inténtalo de nuevo.",
};

const VOTE_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_DECISION: "Elige una decisión antes de confirmar.",
  ROUND_NOT_FOUND: "No hay una ronda activa para votar.",
  ROUND_NOT_VOTING: "La votación de esta ronda ya no está abierta.",
  DUPLICATE_VOTE: "Ya registraste tu voto en esta ronda.",
  JUROR_NOT_FOUND: "Tu acceso ya no es válido. Ingresa tu código de nuevo.",
};

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

/** Resultado de una operación del portal del jurado. Cuando sesionVencida es true, la sesión debe reiniciarse. */
export type JuryResult<T = null> =
  | { ok: true; value: T }
  | { ok: false; sessionExpired: boolean; message: string };

/** Valida el código de acceso y establece la cookie de sesión del jurado. */
export async function loginJury(code: string): Promise<JuryResult> {
  const response = await requestJson<{ ok: boolean; name: string }>("/api/jurado/login", {
    method: "POST",
    body: { code },
  });
  if (response.ok) {
    return { ok: true, value: null };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  const message =
    (response.code !== null ? LOGIN_MESSAGES[response.code] : undefined) ?? SERVER_ERROR_MESSAGE;
  return { ok: false, sessionExpired: false, message: message };
}

/** Lee el view model del portal del jurado para la sesión vigente. */
export async function readJuryState(): Promise<JuryResult<JuryViewModel>> {
  const response = await requestJson<JuryViewModel>("/api/jurado/estado");
  if (response.ok) {
    return { ok: true, value: response.data };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: JURY_SESSION_EXPIRED_MESSAGE };
  }
  return { ok: false, sessionExpired: false, message: SERVER_ERROR_MESSAGE };
}

/** Registra el voto definitivo del jurado en la ronda activa. */
export async function voteJury(decision: Decision): Promise<JuryResult> {
  const response = await requestJson<{ ok: boolean }>("/api/jurado/voto", {
    method: "POST",
    body: { decision },
  });
  if (response.ok) {
    return { ok: true, value: null };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: JURY_SESSION_EXPIRED_MESSAGE };
  }
  const message =
    (response.code !== null ? VOTE_MESSAGES[response.code] : undefined) ?? SERVER_ERROR_MESSAGE;
  return { ok: false, sessionExpired: false, message: message };
}

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
 * cada INTERVALO_SONDEO_JURADO_MS y devuelve al acceso cuando la sesión deja de ser válida.
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
