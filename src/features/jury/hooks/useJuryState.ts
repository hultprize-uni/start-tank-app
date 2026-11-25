import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { USE_MOCKS } from "@/shared/lib/env";
import { usePolling } from "@/shared/lib/use-polling";
import {
  loginJury,
  logoutJury,
  readJuryState,
  saveJuryDraft,
  submitJuryVote,
} from "../api/client";
import { useJuryStateMock } from "../api/mock";
import { DEFAULT_JURY_CRITERIA, type ScoreValue } from "../criteria";
import type {
  JuryAccessView,
  JuryActions,
  JuryViewModel,
  JuryVoteUiState,
} from "../types";
import { useDraft } from "./useDraft";

const INITIAL_ACCESS: JuryAccessView = { status: "idle", errorMessage: null };

const INITIAL_VOTE: JuryVoteUiState = {
  sheet: null,
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
  criteria: DEFAULT_JURY_CRITERIA,
  draftNotes: {},
  draftStatus: "idle",
  draftError: null,
  vote: INITIAL_VOTE,
  votes: { emitted: 0, total: 0 },
  ownVerdict: null,
  reveal: null,
};

/**
 * Combina el estado recibido del servidor con el estado local del diálogo de confirmación. Los
 * diálogos y errores de envío se conservan mientras siga la misma ronda en calificación.
 */
export function mergeJuryState(prev: JuryViewModel, view: JuryViewModel): JuryViewModel {
  const sameGrading =
    prev.screen === "grading" &&
    view.screen === "grading" &&
    prev.round?.id === view.round?.id;
  return {
    ...view,
    access: INITIAL_ACCESS,
    vote: sameGrading ? prev.vote : INITIAL_VOTE,
  };
}

/**
 * Estado del portal del jurado conectado a la API. Tras el acceso con código, sondea el estado
 * cada EVENT_CONFIG.juryPollMs (3 s), persiste el borrador de notas y devuelve al acceso cuando la
 * sesión vence.
 */
/** Estado del portal y, mientras se consulta si hay una sesión vigente, `restoring` en verdadero. */
export interface JuryStateHook {
  state: JuryViewModel;
  actions: JuryActions;
  restoring?: boolean;
}

export function useJuryStateApi(): JuryStateHook {
  const [serverState, setServerState] = useState<JuryViewModel>(INITIAL_JURY_STATE);
  const [sessionActive, setSessionActive] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const endSession = useCallback((message: string) => {
    setSessionActive(false);
    setServerState({ ...INITIAL_JURY_STATE, access: { status: "idle", errorMessage: message } });
  }, []);

  const draft = useDraft({
    roundId: serverState.round?.id ?? null,
    serverNotes: serverState.draftNotes,
    saveNote: saveJuryDraft,
    onSessionExpired: endSession,
  });

  const draftScoresRef = useRef(draft.scores);
  useEffect(() => {
    draftScoresRef.current = draft.scores;
  }, [draft.scores]);

  const criteriaRef = useRef(serverState.criteria);
  useEffect(() => {
    criteriaRef.current = serverState.criteria;
  }, [serverState.criteria]);

  const refresh = useCallback(async () => {
    const result = await readJuryState();
    if (result.ok) {
      setServerState((prev) => mergeJuryState(prev, result.value));
    } else if (result.sessionExpired) {
      endSession(result.message);
    }
  }, [endSession]);

  usePolling(refresh, EVENT_CONFIG.juryPollMs, sessionActive);

  /*
   * Al montar, consulta el estado para restaurar una sesión vigente (por ejemplo tras recargar la
   * página). Si la lectura falla, el portal permanece en el acceso por código.
   */
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await readJuryState();
      if (!active) return;
      setRestoring(false);
      if (!result.ok) return;
      setServerState((prev) => mergeJuryState(prev, result.value));
      setSessionActive(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const submitCode = useCallback((code: string) => {
    setServerState((prev) => ({
      ...prev,
      access: { status: "validating", errorMessage: null },
    }));
    void (async () => {
      const result = await loginJury(code);
      if (!result.ok) {
        setServerState((prev) => ({
          ...prev,
          access: { status: "error", errorMessage: result.message },
        }));
        return;
      }
      setServerState((prev) => ({ ...prev, access: INITIAL_ACCESS }));
      setSessionActive(true);
    })();
  }, []);

  const openConfirmSend = useCallback(() => {
    setServerState((prev) => ({
      ...prev,
      vote: { ...prev.vote, sheet: "confirm_send", errorMessage: null },
    }));
  }, []);

  const openAbstain = useCallback(() => {
    setServerState((prev) => ({
      ...prev,
      vote: { ...prev.vote, sheet: "abstain", errorMessage: null },
    }));
  }, []);

  const closeSheet = useCallback(() => {
    setServerState((prev) => ({ ...prev, vote: { ...prev.vote, sheet: null } }));
  }, []);

  const confirmSend = useCallback(() => {
    const criteria = criteriaRef.current;
    const scores = draftScoresRef.current;
    const notes = criteria.flatMap((criterion) => {
      const value = scores[criterion.id];
      return value === undefined ? [] : [{ criterionId: criterion.id, value }];
    });
    if (notes.length !== criteria.length || criteria.length === 0) return;

    setServerState((prev) => ({
      ...prev,
      vote: { ...prev.vote, submitting: true, errorMessage: null },
    }));

    void (async () => {
      const result = await submitJuryVote({ abstain: false, notes });
      if (result.ok) {
        const submittedScores: Partial<Record<string, ScoreValue>> = {};
        for (const item of notes) {
          submittedScores[item.criterionId] = item.value;
        }
        draft.resetDraft();
        setServerState((prev) => ({
          ...prev,
          screen: "vote_registered",
          draftNotes: {},
          ownVerdict: {
            abstained: false,
            score: result.value.score,
            notes: submittedScores,
          },
          vote: INITIAL_VOTE,
        }));
        await refresh();
        return;
      }
      if (result.sessionExpired) {
        endSession(result.message);
        return;
      }
      setServerState((prev) => ({
        ...prev,
        vote: {
          sheet: null,
          submitting: false,
          errorMessage: result.message,
        },
      }));
      await refresh();
    })();
  }, [draft, refresh, endSession]);

  const confirmAbstain = useCallback(() => {
    setServerState((prev) => ({
      ...prev,
      vote: { ...prev.vote, submitting: true, errorMessage: null },
    }));

    void (async () => {
      const result = await submitJuryVote({ abstain: true });
      if (result.ok) {
        draft.resetDraft();
        setServerState((prev) => ({
          ...prev,
          screen: "vote_registered",
          draftNotes: {},
          ownVerdict: { abstained: true, score: null, notes: {} },
          vote: INITIAL_VOTE,
        }));
        await refresh();
        return;
      }
      if (result.sessionExpired) {
        endSession(result.message);
        return;
      }
      setServerState((prev) => ({
        ...prev,
        vote: {
          sheet: null,
          submitting: false,
          errorMessage: result.message,
        },
      }));
      await refresh();
    })();
  }, [draft, refresh, endSession]);

  const logout = useCallback(() => {
    setSessionActive(false);
    draft.resetDraft();
    void (async () => {
      await logoutJury();
      setServerState({ ...INITIAL_JURY_STATE });
    })();
  }, [draft]);

  const state = useMemo<JuryViewModel>(
    () => ({
      ...serverState,
      draftNotes: draft.scores,
      draftStatus: draft.status,
      draftError: draft.errorMessage,
    }),
    [serverState, draft.scores, draft.status, draft.errorMessage],
  );

  const actions = useMemo<JuryActions>(
    () => ({
      submitCode,
      setScore: draft.setScore,
      openConfirmSend,
      openAbstain,
      closeSheet,
      confirmSend,
      confirmAbstain,
      logout,
    }),
    [
      submitCode,
      draft.setScore,
      openConfirmSend,
      openAbstain,
      closeSheet,
      confirmSend,
      confirmAbstain,
      logout,
    ],
  );

  return { state, actions, restoring };
}

/**
 * Estado del portal del jurado. Usa los datos de muestra solo con NEXT_PUBLIC_USE_MOCKS=true; en
 * otro caso consume la API. La selección ocurre en tiempo de compilación.
 */
export const useJuryState: () => JuryStateHook = USE_MOCKS
  ? useJuryStateMock
  : useJuryStateApi;
