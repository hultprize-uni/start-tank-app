import { useCallback, useEffect, useRef, useState } from "react";
import type { Decision } from "@/shared/domain/types";
import type {
  JuryActions,
  JuryCriterion,
  JuryViewModel,
} from "../types";

/** Código de acceso válido en el mock. */
export const MOCK_JURY_CODE = "4821";

/** Número de jurados que emiten voto en cada ronda. */
const MOCK_JURY_TOTAL = 4;

/** Retardo simulado de la validación del código, en milisegundos. */
const MOCK_ACCESS_DELAY_MS = 600;

/** Retardo simulado antes de que el operador habilite la votación, en milisegundos. */
const MOCK_OPEN_VOTING_DELAY_MS = 4_000;

/** Retardo simulado del envío del voto, en milisegundos. */
const MOCK_SUBMIT_DELAY_MS = 500;

export const MOCK_CRITERIA: readonly JuryCriterion[] = [
  { id: "viability", label: "Viabilidad" },
  { id: "sdg_impact", label: "Impacto ODS" },
];

const INITIAL_STATE: JuryViewModel = {
  screen: "access",
  access: { status: "idle", errorMessage: null },
  jurorLabel: null,
  round: null,
  criteria: MOCK_CRITERIA,
  vote: { draft: null, confirming: false, submitting: false, errorMessage: null },
  votes: { emitted: 0, total: MOCK_JURY_TOTAL },
};

/**
 * Hook de estado simulado del portal del jurado.
 * Reemplazar su implementación por consultas reales sin cambiar la interfaz `JuryViewModel`.
 */
export function useJuryState(): { state: JuryViewModel; actions: JuryActions } {
  const [state, setState] = useState<JuryViewModel>(INITIAL_STATE);
  const timers = useRef<number[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    timers.current.push(window.setTimeout(fn, delay));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const submitCode = useCallback(
    (code: string) => {
      setState((prev) => ({
        ...prev,
        access: { status: "validating", errorMessage: null },
      }));

      schedule(() => {
        setState((prev) => {
          if (code !== MOCK_JURY_CODE) {
            return {
              ...prev,
              access: {
                status: "error",
                errorMessage:
                  "El código no es válido. Revísalo e inténtalo de nuevo.",
              },
            };
          }
          return {
            ...prev,
            screen: "waiting",
            access: { status: "idle", errorMessage: null },
            jurorLabel: "Jurado 3",
            round: { number: 2, startupName: "Startup Nombre" },
          };
        });
      }, MOCK_ACCESS_DELAY_MS);
    },
    [schedule],
  );

  useEffect(() => {
    if (state.screen !== "waiting") return;
    const id = window.setTimeout(() => {
      setState((prev) => ({
        ...prev,
        screen: "voting",
        votes: { ...prev.votes, emitted: 2 },
      }));
    }, MOCK_OPEN_VOTING_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [state.screen]);

  const selectDecision = useCallback((decision: Decision) => {
    setState((prev) => ({
      ...prev,
      vote: { ...prev.vote, draft: decision, confirming: false },
    }));
  }, []);

  const requestConfirm = useCallback(() => {
    setState((prev) => {
      if (prev.vote.draft === null) return prev;
      return { ...prev, vote: { ...prev.vote, confirming: true } };
    });
  }, []);

  const cancelConfirm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      vote: { ...prev.vote, confirming: false },
    }));
  }, []);

  const confirmVote = useCallback(() => {
    setState((prev) => {
      if (prev.vote.draft === null) return prev;
      return { ...prev, vote: { ...prev.vote, submitting: true } };
    });

    schedule(() => {
      setState((prev) => ({
        ...prev,
        screen: "vote_registered",
        vote: { draft: null, confirming: false, submitting: false, errorMessage: null },
        votes: {
          ...prev.votes,
          emitted: Math.min(prev.votes.emitted + 1, prev.votes.total),
        },
      }));
    }, MOCK_SUBMIT_DELAY_MS);
  }, [schedule]);

  return {
    state,
    actions: {
      submitCode,
      selectDecision,
      requestConfirm,
      cancelConfirm,
      confirmVote,
    },
  };
}
