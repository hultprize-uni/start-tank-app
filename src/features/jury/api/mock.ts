import { useCallback, useEffect, useRef, useState } from "react";
import type { Decision } from "@/shared/domain/types";
import { JURY_CRITERIA } from "../criteria";
import type {
  JuryActions,
  JuryAccessView,
  JuryPhase,
  JuryRailItem,
  JuryViewModel,
  JuryVoteView,
} from "../types";
import { screenOf } from "../view-rules";

/** Número de jurados que emiten voto en cada ronda. */
export const MOCK_JURY_TOTAL = 4;

/** Retardo simulado de la validación del código, en milisegundos. */
const MOCK_ACCESS_DELAY_MS = 600;

/** Retardo simulado del envío del voto, en milisegundos. */
const MOCK_SUBMIT_DELAY_MS = 500;

/** Mensaje cuando el código simulado no coincide con ningún jurado. */
export const MOCK_CODE_ERROR = "El código no es válido. Revísalo e inténtalo de nuevo.";

/** Ronda simulada con los votos de los otros jurados y el multiplicador de la liquidación. */
interface MockRound {
  startupName: string;
  sdg: string;
  description: string;
  multiplier: number;
  /** Decisiones de los otros tres jurados, en orden de jurado. */
  others: readonly Decision[];
}

export const MOCK_ROUNDS: readonly MockRound[] = [
  {
    startupName: "AgroSense",
    sdg: "ODS 2",
    description: "Monitoreo de cultivos con sensores de bajo costo para pequeños productores.",
    multiplier: 1.4,
    others: ["BACK", "BACK", "REJECT"],
  },
  {
    startupName: "AguaClara",
    sdg: "ODS 6",
    description: "Filtros comunitarios de agua con seguimiento de calidad en tiempo real.",
    multiplier: 1.2,
    others: ["BACK", "REJECT", "BACK"],
  },
  {
    startupName: "EduRuta",
    sdg: "ODS 4",
    description: "Rutas de aprendizaje personalizadas para estudiantes de educación básica.",
    multiplier: 0.8,
    others: ["REJECT", "REJECT", "BACK"],
  },
  {
    startupName: "SolRed",
    sdg: "ODS 7",
    description: "Microrredes solares para comunidades sin acceso estable a la electricidad.",
    multiplier: 1.6,
    others: ["BACK", "BACK", "BACK"],
  },
  {
    startupName: "SaludCerca",
    sdg: "ODS 3",
    description: "Telemedicina de primer contacto para zonas rurales.",
    multiplier: 1,
    others: ["BACK", "ABSTAIN", "REJECT"],
  },
];

/** Fase de la línea de tiempo simulada. Round es el índice de la ronda, o -1 para el evento final. */
export interface MockStep {
  round: number;
  phase: JuryPhase;
  duration: number;
}

/** Fases de una ronda liquidada o anulada, con su duración en milisegundos. */
function roundSteps(round: number, cancelled: boolean): MockStep[] {
  const head: MockStep[] = [
    { round, phase: "scheduled", duration: 2500 },
    { round, phase: "open", duration: 2500 },
    { round, phase: "last_call", duration: 2500 },
    { round, phase: "closed", duration: 2000 },
  ];
  if (cancelled) return [...head, { round, phase: "cancelled", duration: 5000 }];
  return [
    ...head,
    { round, phase: "voting", duration: 15000 },
    { round, phase: "result", duration: 6000 },
  ];
}

/**
 * Línea de tiempo que recorre todas las fases del prototipo: la segunda ronda se anula y, al final,
 * el evento se cierra. Después vuelve a comenzar.
 */
export const MOCK_TIMELINE: readonly MockStep[] = [
  ...roundSteps(0, false),
  ...roundSteps(1, false),
  ...roundSteps(2, true),
  ...roundSteps(3, false),
  ...roundSteps(4, false),
  { round: -1, phase: "final", duration: 5000 },
];

/** Estado completo de la simulación del portal del jurado. */
export interface MockWorld {
  stepIndex: number;
  /** Índice del jurado de la sesión, o nulo mientras no ingresa. */
  juror: number | null;
  access: JuryAccessView;
  /** Votos propios por índice de ronda. Se reinicia al comenzar la línea de tiempo. */
  ownVotes: Partial<Record<number, Decision>>;
  vote: JuryVoteView;
}

const IDLE_ACCESS: JuryAccessView = { status: "idle", errorMessage: null };

const IDLE_VOTE: JuryVoteView = {
  draft: null,
  confirming: false,
  submitting: false,
  errorMessage: null,
};

export const INITIAL_MOCK_WORLD: MockWorld = {
  stepIndex: 0,
  juror: null,
  access: IDLE_ACCESS,
  ownVotes: {},
  vote: IDLE_VOTE,
};

/**
 * Interpreta un código simulado "JUR-1" a "JUR-4" y devuelve el índice del jurado, o nulo si el
 * código no corresponde a ninguno.
 */
export function parseMockCode(code: string): number | null {
  const match = /^JUR-([1-4])$/.exec(code.trim().toUpperCase());
  return match ? Number(match[1]) - 1 : null;
}

/** Avanza la simulación al siguiente paso de la línea de tiempo. */
export function advanceMockWorld(world: MockWorld): MockWorld {
  const stepIndex = (world.stepIndex + 1) % MOCK_TIMELINE.length;
  const phase = MOCK_TIMELINE[stepIndex].phase;
  return {
    ...world,
    stepIndex,
    ownVotes: stepIndex === 0 ? {} : world.ownVotes,
    vote: phase === "voting" ? world.vote : IDLE_VOTE,
  };
}

/** Recorrido de rondas de la simulación, con las rondas terminadas y la vigente. */
function mockRail(roundIndex: number, phase: JuryPhase, world: MockWorld): JuryRailItem[] {
  return MOCK_ROUNDS.map((round, index) => {
    const finished =
      phase === "final" ||
      index < roundIndex ||
      (index === roundIndex && (phase === "result" || phase === "cancelled"));
    let status: JuryRailItem["status"] = "pending";
    if (finished) status = "settled";
    else if (index === roundIndex) status = "current";

    return {
      number: index + 1,
      startupName: round.startupName,
      status,
      ownDecision: finished ? (world.ownVotes[index] ?? null) : null,
    };
  });
}

/**
 * Construye el view model que corresponde a la simulación. Es una función pura: el hook solo
 * controla el tiempo y los eventos del usuario.
 */
export function buildMockView(world: MockWorld): JuryViewModel {
  const step = MOCK_TIMELINE[world.stepIndex];
  const roundIndex = step.round;
  const round = roundIndex >= 0 ? MOCK_ROUNDS[roundIndex] : undefined;
  const base: JuryViewModel = {
    screen: "access",
    phase: null,
    access: world.access,
    jurorLabel: null,
    round: null,
    rail: [],
    criteria: JURY_CRITERIA,
    vote: world.vote,
    votes: { emitted: 0, total: MOCK_JURY_TOTAL },
    ownVote: null,
    reveal: null,
  };
  if (world.juror === null) return base;

  const ownVote = round ? (world.ownVotes[roundIndex] ?? null) : null;
  const reveal =
    step.phase === "result" && round
      ? {
          multiplier: round.multiplier,
          isLastRound: roundIndex === MOCK_ROUNDS.length - 1,
          votes: revealedVotes(world.juror, ownVote, round.others),
        }
      : null;

  return {
    ...base,
    screen: screenOf(step.phase, ownVote),
    phase: step.phase,
    jurorLabel: `Jurado ${world.juror + 1}`,
    round: round
      ? {
          number: roundIndex + 1,
          total: MOCK_ROUNDS.length,
          startupName: round.startupName,
          sdg: round.sdg,
          description: round.description,
        }
      : null,
    rail: mockRail(roundIndex, step.phase, world),
    votes: {
      emitted: round ? MOCK_JURY_TOTAL - 1 + (ownVote === null ? 0 : 1) : 0,
      total: MOCK_JURY_TOTAL,
    },
    ownVote,
    reveal,
  };
}

/** Votos publicados al liquidar: el del jurado de la sesión y los de los otros tres. */
function revealedVotes(
  juror: number,
  ownVote: Decision | null,
  others: readonly Decision[],
): { label: string; isOwn: boolean; decision: Decision | null }[] {
  let other = 0;
  return Array.from({ length: MOCK_JURY_TOTAL }, (_, index) => {
    const isOwn = index === juror;
    return {
      label: `Jurado ${index + 1}`,
      isOwn,
      decision: isOwn ? ownVote : (others[other++] ?? null),
    };
  });
}

/**
 * Hook de estado simulado del portal del jurado. Recorre la línea de tiempo del prototipo y
 * conserva el voto del jurado. Reemplazar su uso por la API real no cambia la interfaz.
 */
export function useJuryStateMock(): { state: JuryViewModel; actions: JuryActions } {
  const [world, setWorld] = useState<MockWorld>(INITIAL_MOCK_WORLD);
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

  useEffect(() => {
    const id = window.setTimeout(
      () => setWorld(advanceMockWorld),
      MOCK_TIMELINE[world.stepIndex].duration,
    );
    return () => window.clearTimeout(id);
  }, [world.stepIndex]);

  const submitCode = useCallback(
    (code: string) => {
      setWorld((prev) => ({ ...prev, access: { status: "validating", errorMessage: null } }));
      schedule(() => {
        setWorld((prev) => {
          const juror = parseMockCode(code);
          if (juror === null) {
            return { ...prev, access: { status: "error", errorMessage: MOCK_CODE_ERROR } };
          }
          return { ...prev, juror, access: IDLE_ACCESS };
        });
      }, MOCK_ACCESS_DELAY_MS);
    },
    [schedule],
  );

  const selectDecision = useCallback((decision: Decision) => {
    setWorld((prev) => ({
      ...prev,
      vote: { ...prev.vote, draft: decision, confirming: false, errorMessage: null },
    }));
  }, []);

  const requestConfirm = useCallback(() => {
    setWorld((prev) =>
      prev.vote.draft === null ? prev : { ...prev, vote: { ...prev.vote, confirming: true } },
    );
  }, []);

  const cancelConfirm = useCallback(() => {
    setWorld((prev) => ({ ...prev, vote: { ...prev.vote, confirming: false } }));
  }, []);

  const confirmVote = useCallback(() => {
    setWorld((prev) =>
      prev.vote.draft === null
        ? prev
        : { ...prev, vote: { ...prev.vote, submitting: true, errorMessage: null } },
    );
    schedule(() => {
      setWorld((prev) => {
        const decision = prev.vote.draft;
        const step = MOCK_TIMELINE[prev.stepIndex];
        if (decision === null || step.phase !== "voting") {
          return { ...prev, vote: IDLE_VOTE };
        }
        return {
          ...prev,
          ownVotes: { ...prev.ownVotes, [step.round]: decision },
          vote: IDLE_VOTE,
        };
      });
    }, MOCK_SUBMIT_DELAY_MS);
  }, [schedule]);

  return {
    state: buildMockView(world),
    actions: { submitCode, selectDecision, requestConfirm, cancelConfirm, confirmVote },
  };
}
