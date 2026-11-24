import { describe, expect, it } from "vitest";
import {
  INITIAL_MOCK_WORLD,
  MOCK_ROUNDS,
  MOCK_TIMELINE,
  advanceMockWorld,
  buildMockView,
  parseMockCode,
  type MockWorld,
} from "./mock";
import type { JuryPhase } from "../types";

/** Índice del primer paso de la línea de tiempo con la fase indicada. */
function stepOf(phase: JuryPhase, round?: number): number {
  return MOCK_TIMELINE.findIndex(
    (step) => step.phase === phase && (round === undefined || step.round === round),
  );
}

/** Estado de simulación con un jurado ingresado, posicionado en el paso indicado. */
function worldAt(stepIndex: number, overrides: Partial<MockWorld> = {}): MockWorld {
  return { ...INITIAL_MOCK_WORLD, stepIndex, juror: 1, ...overrides };
}

describe("parseMockCode", () => {
  it("reconoce los códigos JUR-1 a JUR-4 sin distinguir mayúsculas", () => {
    expect(parseMockCode("JUR-1")).toBe(0);
    expect(parseMockCode(" jur-4 ")).toBe(3);
  });

  it("rechaza cualquier otro código", () => {
    expect(parseMockCode("JUR-5")).toBeNull();
    expect(parseMockCode("4821")).toBeNull();
  });
});

describe("MOCK_TIMELINE", () => {
  it("recorre todas las fases del prototipo", () => {
    const phases = new Set(MOCK_TIMELINE.map((step) => step.phase));
    expect([...phases].sort()).toEqual(
      [
        "cancelled",
        "closed",
        "final",
        "last_call",
        "open",
        "result",
        "scheduled",
        "voting",
      ].sort(),
    );
  });

  it("referencia rondas válidas en cada paso, salvo el evento final", () => {
    for (const step of MOCK_TIMELINE) {
      if (step.phase === "final") expect(step.round).toBe(-1);
      else expect(MOCK_ROUNDS[step.round]).toBeDefined();
    }
  });
});

describe("advanceMockWorld", () => {
  it("avanza al siguiente paso y vuelve al inicio al terminar la línea de tiempo", () => {
    const last = MOCK_TIMELINE.length - 1;
    expect(advanceMockWorld(worldAt(0)).stepIndex).toBe(1);
    expect(advanceMockWorld(worldAt(last)).stepIndex).toBe(0);
  });

  it("conserva el borrador al pasar de open a last_call dentro de la misma ronda", () => {
    const open = stepOf("open", 0);
    const next = advanceMockWorld(worldAt(open, { draftNotes: { 0: { "1": 4 } } }));
    expect(next.draftNotes[0]).toEqual({ "1": 4 });
  });

  it("reinicia borradores y envíos propios al comenzar una nueva vuelta", () => {
    const last = MOCK_TIMELINE.length - 1;
    const world = worldAt(last, {
      draftNotes: { 0: { "1": 4 } },
      ownVerdicts: { 0: { abstained: false, score: 4, notes: { "1": 4 } } },
    });
    const next = advanceMockWorld(world);
    expect(next.draftNotes).toEqual({});
    expect(next.ownVerdicts).toEqual({});
  });
});

describe("buildMockView", () => {
  it.each([
    ["scheduled", 0, "waiting"],
    ["open", 0, "grading"],
    ["last_call", 0, "grading"],
    ["closed", 0, "grading"],
    ["cancelled", 2, "waiting"],
    ["final", -1, "waiting"],
    ["voting", 0, "grading"],
    ["result", 0, "result"],
  ] as const)("muestra la pantalla de la fase %s de la ronda %i", (phase, round, screen) => {
    const view = buildMockView(worldAt(stepOf(phase, round)));
    expect(view).toMatchObject({ phase, screen });
  });

  it("muestra el acceso mientras el jurado no ha ingresado", () => {
    const view = buildMockView({ ...INITIAL_MOCK_WORLD, stepIndex: stepOf("voting", 0) });
    expect(view).toMatchObject({ screen: "access", phase: null, jurorLabel: null });
  });

  it("registra el envío del jurado y cuenta cuatro envíos emitidos", () => {
    const view = buildMockView(
      worldAt(stepOf("voting", 0), {
        ownVerdicts: {
          0: { abstained: false, score: 4, notes: { "1": 4, "2": 4, "3": 4, "4": 4 } },
        },
      }),
    );
    expect(view).toMatchObject({
      screen: "vote_registered",
      ownVerdict: { abstained: false, score: 4 },
      votes: { emitted: 4, total: 4 },
    });
  });

  it("publica el veredicto con el puntaje, el multiplicador y las notas de los cuatro jurados", () => {
    const view = buildMockView(
      worldAt(stepOf("result", 0), {
        ownVerdicts: {
          0: { abstained: false, score: 4, notes: { "1": 4, "2": 4, "3": 4, "4": 4 } },
        },
      }),
    );
    expect(view.reveal).toMatchObject({
      isLastRound: false,
      startupScore: expect.any(Number),
      multiplier: expect.any(Number),
    });
    expect(view.reveal?.jurors).toHaveLength(4);
    expect(view.reveal?.jurors[1]).toMatchObject({
      label: "Jurado 2",
      isOwn: true,
      submitted: true,
      abstained: false,
      score: 4,
    });
  });

  it("marca como settled las rondas terminadas con el puntaje propio", () => {
    const view = buildMockView(
      worldAt(stepOf("voting", 3), {
        ownVerdicts: {
          0: { abstained: false, score: 4.25, notes: {} },
          1: { abstained: true, score: null, notes: {} },
        },
      }),
    );
    expect(view.rail.map((item) => item.status)).toEqual([
      "settled",
      "settled",
      "settled",
      "current",
      "pending",
    ]);
    expect(view.rail[0].ownVerdict).toEqual({ abstained: false, score: 4.25 });
    expect(view.rail[1].ownVerdict).toEqual({ abstained: true, score: null });
  });
});
