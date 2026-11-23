import { useCallback, useEffect, useRef, useState } from "react";
import { calcScoreVerdict, juryScore } from "@/shared/domain/verdict";
import { DEFAULT_JURY_CRITERIA, type ScoreValue } from "../criteria";
import type {
  CriteriaScores,
  JuryActions,
  JuryAccessView,
  JuryPhase,
  JuryRailItem,
  JuryRevealJuror,
  JuryViewModel,
  JuryVoteUiState,
  OwnVerdictView,
} from "../types";
import { isGradablePhase, screenOf } from "../view-rules";

/** Número de jurados que emiten envío en cada ronda. */
export const MOCK_JURY_TOTAL = 4;

/** Retardo simulado de la validación del código, en milisegundos. */
const MOCK_ACCESS_DELAY_MS = 600;

/** Retardo simulado del envío definitivo, en milisegundos. */
const MOCK_SUBMIT_DELAY_MS = 500;

/** Mensaje cuando el código simulado no coincide con ningún jurado. */
export const MOCK_CODE_ERROR =
  "Ese código no existe. Revísalo con el equipo organizador e inténtalo de nuevo.";

type FourNotes = readonly [ScoreValue, ScoreValue, ScoreValue, ScoreValue];

/** Ronda simulada con las notas de los otros jurados (null si se abstuvo). */
interface MockRound {
  startupName: string;
  sdg: string;
  description: string;
  othersNotes: readonly (FourNotes | null)[];
}

export const MOCK_ROUNDS: readonly MockRound[] = [
  {
    startupName: "AgroSense",
    sdg: "ODS 2",
    description: "Monitoreo de cultivos con sensores de bajo costo para pequeños productores.",
    othersNotes: [
      [4, 4, 5, 4],
      [4, 3, 4, 4],
      [3, 4, 4, 3],
    ],
  },
  {
    startupName: "AguaClara",
    sdg: "ODS 6",
    description: "Filtros comunitarios de agua con seguimiento de calidad en tiempo real.",
    othersNotes: [
      [4, 4, 4, 4],
      [3, 4, 3, 4],
      [4, 3, 5, 4],
    ],
  },
  {
    startupName: "EduRuta",
    sdg: "ODS 4",
    description: "Rutas de aprendizaje personalizadas para estudiantes de educación básica.",
    othersNotes: [
      [2, 3, 3, 2],
      [3, 2, 3, 2],
      [4, 3, 4, 3],
    ],
  },
  {
    startupName: "SolRed",
    sdg: "ODS 7",
    description: "Microrredes solares para comunidades sin acceso estable a la electricidad.",
    othersNotes: [
      [5, 4, 5, 5],
      [4, 5, 5, 4],
      [5, 5, 4, 5],
    ],
  },
  {
    startupName: "SaludCerca",
    sdg: "ODS 3",
    description: "Telemedicina de primer contacto para zonas rurales.",
    othersNotes: [[4, 3, 4, 3], null, [3, 3, 4, 3]],
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
    { round, phase: "open", duration: 6000 },
    { round, phase: "last_call", duration: 3000 },
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
 * Línea de tiempo que recorre todas las fases del prototipo: la tercera ronda se anula y, al
 * final, el evento se cierra. Después vuelve a comenzar.
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
  /** Borradores guardados por índice de ronda. */
  draftNotes: Partial<Record<number, CriteriaScores>>;
  /** Envíos propios por índice de ronda. Se reinicia al comenzar la línea de tiempo. */
  ownVerdicts: Partial<Record<number, OwnVerdictView>>;
  vote: JuryVoteUiState;
}

const IDLE_ACCESS: JuryAccessView = { status: "idle", errorMessage: null };

const IDLE_VOTE: JuryVoteUiState = {
  sheet: null,
  submitting: false,
  errorMessage: null,
};

export const INITIAL_MOCK_WORLD: MockWorld = {
  stepIndex: 0,
  juror: null,
  access: IDLE_ACCESS,
  draftNotes: {},
  ownVerdicts: {},
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
  const nextStep = MOCK_TIMELINE[stepIndex];
  const sameRound = nextStep.round === MOCK_TIMELINE[world.stepIndex].round;
  return {
    ...world,
    stepIndex,
    draftNotes: stepIndex === 0 ? {} : world.draftNotes,
    ownVerdicts: stepIndex === 0 ? {} : world.ownVerdicts,
    vote: sameRound && isGradablePhase(nextStep.phase) ? world.vote : IDLE_VOTE,
  };
}

function toCriteriaScores(notes: FourNotes): CriteriaScores {
  const scores: CriteriaScores = {};
  DEFAULT_JURY_CRITERIA.forEach((criterion, index) => {
    scores[criterion.id] = notes[index];
  });
  return scores;
}

function computeScoreFromScores(notes: CriteriaScores): number | null {
  const items = DEFAULT_JURY_CRITERIA.flatMap((criterion) => {
    const value = notes[criterion.id];
    return value === undefined ? [] : [{ value, weight: criterion.weight }];
  });
  return items.length === DEFAULT_JURY_CRITERIA.length ? juryScore(items) : null;
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

    const own = finished ? world.ownVerdicts[index] : undefined;
    return {
      number: index + 1,
      startupName: round.startupName,
      status,
      ownVerdict: own ? { abstained: own.abstained, score: own.score } : null,
    };
  });
}

function revealedJurors(
  juror: number,
  ownVerdict: OwnVerdictView | null,
  othersNotes: readonly (FourNotes | null)[],
): JuryRevealJuror[] {
  let otherIndex = 0;
  return Array.from({ length: MOCK_JURY_TOTAL }, (_, index) => {
    const isOwn = index === juror;
    if (isOwn) {
      return {
        label: `Jurado ${index + 1}`,
        isOwn: true,
        submitted: ownVerdict !== null,
        abstained: ownVerdict?.abstained ?? false,
        score: ownVerdict?.score ?? null,
        notes: ownVerdict?.notes ?? {},
      };
    }

    const other = othersNotes[otherIndex++] ?? null;
    if (other === null) {
      return {
        label: `Jurado ${index + 1}`,
        isOwn: false,
        submitted: true,
        abstained: true,
        score: null,
        notes: {},
      };
    }
    const notes = toCriteriaScores(other);
    return {
      label: `Jurado ${index + 1}`,
      isOwn: false,
      submitted: true,
      abstained: false,
      score: computeScoreFromScores(notes),
      notes,
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
    clock: null,
    access: world.access,
    jurorLabel: null,
    round: null,
    rail: [],
    criteria: DEFAULT_JURY_CRITERIA,
    draftNotes: {},
    draftStatus: "idle",
    draftError: null,
    vote: world.vote,
    votes: { emitted: 0, total: MOCK_JURY_TOTAL },
    ownVerdict: null,
    reveal: null,
  };
  if (world.juror === null) return base;

  const ownVerdict = round ? (world.ownVerdicts[roundIndex] ?? null) : null;
  const draftNotes = round && ownVerdict === null ? (world.draftNotes[roundIndex] ?? {}) : {};
  const jurors = round ? revealedJurors(world.juror, ownVerdict, round.othersNotes) : [];
  const verdictSummary = calcScoreVerdict(jurors.map((j) => (j.submitted && !j.abstained ? j.score : null)));

  const reveal =
    step.phase === "result" && round
      ? {
          startupScore: verdictSummary?.score ?? null,
          multiplier: verdictSummary?.multiplier ?? null,
          isLastRound: roundIndex === MOCK_ROUNDS.length - 1,
          jurors,
        }
      : null;

  const now = Date.now();
  const hasTimer =
    step.phase === "open" ||
    step.phase === "last_call" ||
    step.phase === "voting" ||
    step.phase === "result";

  return {
    ...base,
    screen: screenOf(step.phase, ownVerdict !== null),
    phase: step.phase,
    clock: hasTimer
      ? {
          serverTime: new Date(now).toISOString(),
          phaseEndsAt: new Date(now + step.duration).toISOString(),
          paused: false,
          pausedSeconds: null,
        }
      : null,
    jurorLabel: `Jurado ${world.juror + 1}`,
    round: round
      ? {
          id: String(roundIndex + 1),
          number: roundIndex + 1,
          total: MOCK_ROUNDS.length,
          startupName: round.startupName,
          sdg: round.sdg,
          description: round.description,
          logoUrl: null,
        }
      : null,
    rail: mockRail(roundIndex, step.phase, world),
    draftNotes,
    draftStatus: Object.keys(draftNotes).length > 0 ? "saved" : "idle",
    votes: {
      emitted: round ? MOCK_JURY_TOTAL - 1 + (ownVerdict === null ? 0 : 1) : 0,
      total: MOCK_JURY_TOTAL,
    },
    ownVerdict,
    reveal,
  };
}

/**
 * Hook de estado simulado del portal del jurado. Recorre la línea de tiempo del prototipo y
 * conserva el borrador y los envíos del jurado.
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

  const setScore = useCallback((criterionId: string, value: ScoreValue) => {
    setWorld((prev) => {
      const step = MOCK_TIMELINE[prev.stepIndex];
      if (step.round < 0 || !isGradablePhase(step.phase) || prev.ownVerdicts[step.round]) {
        return prev;
      }
      const existing = prev.draftNotes[step.round] ?? {};
      return {
        ...prev,
        draftNotes: {
          ...prev.draftNotes,
          [step.round]: { ...existing, [criterionId]: value },
        },
        vote: { ...prev.vote, errorMessage: null },
      };
    });
  }, []);

  const openConfirmSend = useCallback(() => {
    setWorld((prev) => ({
      ...prev,
      vote: { ...prev.vote, sheet: "confirm_send", errorMessage: null },
    }));
  }, []);

  const openAbstain = useCallback(() => {
    setWorld((prev) => ({
      ...prev,
      vote: { ...prev.vote, sheet: "abstain", errorMessage: null },
    }));
  }, []);

  const closeSheet = useCallback(() => {
    setWorld((prev) => ({ ...prev, vote: { ...prev.vote, sheet: null } }));
  }, []);

  const confirmSend = useCallback(() => {
    setWorld((prev) => ({
      ...prev,
      vote: { ...prev.vote, submitting: true, errorMessage: null },
    }));
    schedule(() => {
      setWorld((prev) => {
        const step = MOCK_TIMELINE[prev.stepIndex];
        const notes = prev.draftNotes[step.round] ?? {};
        const score = computeScoreFromScores(notes);
        if (step.phase !== "voting" || score === null) {
          return { ...prev, vote: IDLE_VOTE };
        }
        const nextDrafts = { ...prev.draftNotes };
        delete nextDrafts[step.round];
        return {
          ...prev,
          draftNotes: nextDrafts,
          ownVerdicts: {
            ...prev.ownVerdicts,
            [step.round]: { abstained: false, score, notes },
          },
          vote: IDLE_VOTE,
        };
      });
    }, MOCK_SUBMIT_DELAY_MS);
  }, [schedule]);

  const confirmAbstain = useCallback(() => {
    setWorld((prev) => ({
      ...prev,
      vote: { ...prev.vote, submitting: true, errorMessage: null },
    }));
    schedule(() => {
      setWorld((prev) => {
        const step = MOCK_TIMELINE[prev.stepIndex];
        if (step.phase !== "voting") {
          return { ...prev, vote: IDLE_VOTE };
        }
        const nextDrafts = { ...prev.draftNotes };
        delete nextDrafts[step.round];
        return {
          ...prev,
          draftNotes: nextDrafts,
          ownVerdicts: {
            ...prev.ownVerdicts,
            [step.round]: { abstained: true, score: null, notes: {} },
          },
          vote: IDLE_VOTE,
        };
      });
    }, MOCK_SUBMIT_DELAY_MS);
  }, [schedule]);

  const logout = useCallback(() => {
    setWorld((prev) => ({ ...prev, juror: null, access: IDLE_ACCESS, vote: IDLE_VOTE }));
  }, []);

  return {
    state: buildMockView(world),
    actions: {
      submitCode,
      setScore,
      openConfirmSend,
      openAbstain,
      closeSheet,
      confirmSend,
      confirmAbstain,
      logout,
    },
  };
}
