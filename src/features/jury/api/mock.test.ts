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

  it("descarta el borrador al salir de la votación", () => {
    const voting = stepOf("voting", 0);
    const draft = { draft: "BACK" as const, confirming: true, submitting: false, errorMessage: null };

    expect(advanceMockWorld(worldAt(voting, { vote: draft })).vote.draft).toBeNull();
  });

  it("reinicia los votos propios al comenzar una nueva vuelta", () => {
    const last = MOCK_TIMELINE.length - 1;
    const world = worldAt(last, { ownVotes: { 0: "BACK" } });
    expect(advanceMockWorld(world).ownVotes).toEqual({});
  });
});

describe("buildMockView", () => {
  it.each([
    ["scheduled", 0, "waiting"],
    ["open", 0, "waiting"],
    ["last_call", 0, "waiting"],
    ["closed", 0, "waiting"],
    ["cancelled", 2, "waiting"],
    ["final", -1, "waiting"],
    ["voting", 0, "voting"],
    ["result", 0, "result"],
  ] as const)("muestra la pantalla de la fase %s de la ronda %i", (phase, round, screen) => {
    const view = buildMockView(worldAt(stepOf(phase, round)));
    expect(view).toMatchObject({ phase, screen });
  });

  it("muestra el acceso mientras el jurado no ha ingresado", () => {
    const view = buildMockView({ ...INITIAL_MOCK_WORLD, stepIndex: stepOf("voting", 0) });
    expect(view).toMatchObject({ screen: "access", phase: null, jurorLabel: null });
  });

  it("registra el voto del jurado y cuenta cuatro votos emitidos", () => {
    const view = buildMockView(
      worldAt(stepOf("voting", 0), { ownVotes: { 0: "REJECT" } }),
    );
    expect(view).toMatchObject({
      screen: "vote_registered",
      ownVote: "REJECT",
      votes: { emitted: 4, total: 4 },
    });
  });

  it("publica el veredicto con el multiplicador y los cuatro votos al liquidar", () => {
    const view = buildMockView(worldAt(stepOf("result", 0), { ownVotes: { 0: "BACK" } }));
    expect(view.reveal).toEqual({
      multiplier: MOCK_ROUNDS[0].multiplier,
      isLastRound: false,
      votes: [
        { label: "Jurado 1", isOwn: false, decision: "BACK" },
        { label: "Jurado 2", isOwn: true, decision: "BACK" },
        { label: "Jurado 3", isOwn: false, decision: "BACK" },
        { label: "Jurado 4", isOwn: false, decision: "REJECT" },
      ],
    });
  });

  it("marca como settled las rondas terminadas con el voto propio", () => {
    const view = buildMockView(
      worldAt(stepOf("voting", 3), { ownVotes: { 0: "BACK", 1: "REJECT" } }),
    );
    expect(view.rail.map((item) => item.status)).toEqual([
      "settled",
      "settled",
      "settled",
      "current",
      "pending",
    ]);
    expect(view.rail[1].ownDecision).toBe("REJECT");
  });
});
