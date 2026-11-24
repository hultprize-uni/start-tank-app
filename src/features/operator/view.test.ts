import { describe, expect, it } from "vitest";

import type { PhaseDurations, RoundStatus } from "./types";
import {
  buildMainAction,
  buildOperatorView,
  buildSchedule,
  buildSteps,
  referenceRound,
  type OperatorSnapshot,
  type SnapshotJuror,
  type SnapshotRound,
} from "./view";

const NOW = new Date("2026-11-26T19:30:00.000Z");

const DURATIONS: PhaseDurations = { pitch: 300, qa: 600, lastCall: 60, voting: 150, result: 90 };

function round(number: number, status: RoundStatus, extra: Partial<SnapshotRound> = {}): SnapshotRound {
  return {
    number,
    startupName: `Startup ${number}`,
    sdg: "ODS 6",
    status,
    multiplier: null,
    juryScore: null,
    phaseEndsAt: null,
    pausedSeconds: null,
    accumulated: 0,
    uniqueInvestors: 0,
    price: 100,
    ...extra,
  };
}

function juror(id: string, extra: Partial<SnapshotJuror> = {}): SnapshotJuror {
  return {
    id,
    name: `Jurado ${id}`,
    sent: false,
    abstains: false,
    drafting: false,
    score: null,
    secondsSinceSeen: 2,
    ...extra,
  };
}

const FOUR_SENT = ["1", "2", "3", "4"].map((id) => juror(id, { sent: true, score: 4 }));

function snapshot(extra: Partial<OperatorSnapshot> = {}): OperatorSnapshot {
  return {
    now: NOW,
    operator: { name: "Diego", role: "CONDUCTOR" },
    flags: { eventStarted: true, manualMode: false },
    durations: DURATIONS,
    rounds: [round(1, "SCHEDULED"), round(2, "SCHEDULED")],
    firstOpenAt: null,
    jurors: [],
    cancelMode: null,
    attendeesOnline: 0,
    attendeesTotal: 0,
    actions: [],
    balances: [],
    positions: [],
    ...extra,
  };
}

describe("referenceRound", () => {
  it("prefiere la ronda en curso, luego la programada y luego la última terminada", () => {
    expect(referenceRound([round(1, "SETTLED"), round(2, "VOTING"), round(3, "SCHEDULED")])?.number).toBe(2);
    expect(referenceRound([round(1, "SETTLED"), round(2, "SCHEDULED")])?.number).toBe(2);
    expect(referenceRound([round(1, "SETTLED"), round(2, "CANCELLED")])?.number).toBe(2);
    expect(referenceRound([])).toBeUndefined();
  });
});

describe("buildMainAction (RF-06)", () => {
  it.each<[RoundStatus, string]>([
    ["SCHEDULED", "Abrir mercado"],
    ["OPEN", "Anunciar última llamada"],
    ["LAST_CALL", "Cerrar mercado"],
    ["CLOSED", "Habilitar votación"],
    ["VOTING", "Revelar veredicto"],
  ])("con la ronda %s muestra solo %s", (status, label) => {
    expect(buildMainAction(status, FOUR_SENT)?.label).toBe(label);
  });

  it("no ofrece paso con la ronda terminada", () => {
    expect(buildMainAction("SETTLED", FOUR_SENT)).toBeNull();
    expect(buildMainAction("CANCELLED", FOUR_SENT)).toBeNull();
  });

  it("bloquea Revelar hasta los 4 envíos (RF-18)", () => {
    const jurors = [...FOUR_SENT.slice(0, 3), juror("4")];
    const action = buildMainAction("VOTING", jurors);
    expect(action?.enabled).toBe(false);
    expect(action?.blockedReason).toBe("Falta 1 jurado por enviar");
  });

  it("habilita Revelar con los 4 envíos, aunque alguno se abstenga", () => {
    const jurors = [...FOUR_SENT.slice(0, 3), juror("4", { sent: true, abstains: true })];
    expect(buildMainAction("VOTING", jurors)?.enabled).toBe(true);
  });

  it("bloquea Revelar si todos se abstuvieron", () => {
    const jurors = FOUR_SENT.map((item) => ({ ...item, abstains: true, score: null }));
    expect(buildMainAction("VOTING", jurors)?.enabled).toBe(false);
  });

  it("avisa que la última llamada se cierra sola", () => {
    expect(buildMainAction("LAST_CALL", [])?.hint).toMatch(/0:00/);
  });
});

describe("buildSteps", () => {
  it("marca los pasos hechos, el actual y los pendientes", () => {
    expect(buildSteps("CLOSED").map((step) => step.state)).toEqual([
      "done",
      "done",
      "done",
      "current",
      "pending",
    ]);
    expect(buildSteps("SETTLED").every((step) => step.state === "done")).toBe(true);
  });
});

describe("buildSchedule (tarea 5.3)", () => {
  const firstOpenAt = "2026-11-26T19:30:00.000Z";

  it("da atraso cuando el estado actual terminará después de lo planeado", () => {
    // Ronda 2 abierta: el mercado debería cerrar a los 1200 + 900 s del inicio.
    const now = new Date(Date.parse(firstOpenAt) + (1200 + 900 - 300) * 1000);
    const schedule = buildSchedule({
      firstOpenAt,
      roundNumber: 2,
      status: "OPEN",
      secondsLeft: 480, // termina 180 s después de lo planeado
      durations: DURATIONS,
      now,
    });
    expect(schedule.deltaSeconds).toBe(180);
    expect(schedule.plannedAt).toBe(new Date(Date.parse(firstOpenAt) + 2100 * 1000).toISOString());
  });

  it("da adelanto con valores negativos", () => {
    const now = new Date(Date.parse(firstOpenAt) + 1000 * 1000);
    const schedule = buildSchedule({
      firstOpenAt,
      roundNumber: 2,
      status: "SCHEDULED",
      secondsLeft: null,
      durations: DURATIONS,
      now,
    });
    expect(schedule.deltaSeconds).toBe(-200);
  });

  it("no calcula sin la apertura de la primera ronda", () => {
    expect(
      buildSchedule({
        firstOpenAt: null,
        roundNumber: 1,
        status: "SCHEDULED",
        secondsLeft: null,
        durations: DURATIONS,
        now: NOW,
      }).deltaSeconds,
    ).toBeNull();
  });
});

describe("buildOperatorView", () => {
  it("devuelve null sin rondas", () => {
    expect(buildOperatorView(snapshot({ rounds: [] }))).toBeNull();
  });

  it("oculta las notas de los jurados hasta liquidar (RNF-11)", () => {
    const voting = buildOperatorView(
      snapshot({ rounds: [round(1, "VOTING")], jurors: FOUR_SENT }),
    );
    expect(voting?.jurors.every((item) => item.score === null)).toBe(true);
    expect(voting?.jurors.every((item) => item.status === "sent")).toBe(true);

    const settled = buildOperatorView(
      snapshot({ rounds: [round(1, "SETTLED", { juryScore: 4, multiplier: 1.4 })], jurors: FOUR_SENT }),
    );
    expect(settled?.jurors.map((item) => item.score)).toEqual([4, 4, 4, 4]);
  });

  it("marca jurados calificando, desconectados y sin notas", () => {
    const view = buildOperatorView(
      snapshot({
        rounds: [round(1, "VOTING")],
        jurors: [
          juror("1", { drafting: true }),
          juror("2", { secondsSinceSeen: 50 }),
          juror("3", { sent: true, abstains: true }),
          juror("4", { secondsSinceSeen: null }),
        ],
      }),
    );
    expect(view?.jurors.map((item) => item.status)).toEqual([
      "drafting",
      "pending",
      "abstained",
      "pending",
    ]);
    expect(view?.jurors.map((item) => item.online)).toEqual([true, false, true, false]);
  });

  it("ofrece el rescate en la votación con envíos pendientes y al menos una nota", () => {
    const partial = [...FOUR_SENT.slice(0, 3), juror("4")];
    expect(
      buildOperatorView(snapshot({ rounds: [round(1, "VOTING")], jurors: partial }))?.canRescue,
    ).toBe(true);
    expect(
      buildOperatorView(snapshot({ rounds: [round(1, "VOTING")], jurors: FOUR_SENT }))?.canRescue,
    ).toBe(false);
    expect(
      buildOperatorView(snapshot({ rounds: [round(1, "CLOSED")], jurors: partial }))?.canRescue,
    ).toBe(false);
  });

  it("congela el reloj en pausa y solo permite ajustar fases con cronómetro", () => {
    const paused = buildOperatorView(
      snapshot({ rounds: [round(1, "OPEN", { pausedSeconds: 90 })] }),
    );
    expect(paused?.clock).toMatchObject({ paused: true, pausedSeconds: 90, phaseEndsAt: null });
    expect(paused?.timerAdjustable).toBe(true);

    const closed = buildOperatorView(snapshot({ rounds: [round(1, "CLOSED")] }));
    expect(closed?.timerAdjustable).toBe(false);
  });

  it("permite anular solo con la ronda en curso y cerrar el evento con todo terminado", () => {
    expect(buildOperatorView(snapshot({ rounds: [round(1, "OPEN")] }))?.canCancel).toBe(true);
    expect(buildOperatorView(snapshot({ rounds: [round(1, "SCHEDULED")] }))?.canCancel).toBe(false);
    const done = buildOperatorView(
      snapshot({ rounds: [round(1, "SETTLED", { juryScore: 3 }), round(2, "CANCELLED")] }),
    );
    expect(done?.canCloseEvent).toBe(true);
    expect(done?.mainAction).toBeNull();
  });

  it("ordena las startups liquidadas por puntaje del jurado y expone el último corte", () => {
    const view = buildOperatorView(
      snapshot({
        rounds: [
          round(1, "SETTLED", { juryScore: 3.5, multiplier: 1.2 }),
          round(2, "SETTLED", { juryScore: 4.4, multiplier: 1.56 }),
          round(3, "SCHEDULED"),
        ],
      }),
    );
    expect(view?.standings.map((item) => item.roundNumber)).toEqual([2, 1]);
    expect(view?.event.lastSettledRound).toEqual({ number: 2, startupName: "Startup 2" });
  });

  it("traduce el log con el motivo (RF-09)", () => {
    const view = buildOperatorView(
      snapshot({
        actions: [
          {
            id: "9",
            at: new Date("2026-11-26T20:08:00.000Z"),
            roundNumber: 3,
            action: "CLOSE",
            operator: "Diego",
            reason: null,
          },
          {
            id: "10",
            at: new Date("2026-11-26T20:10:00.000Z"),
            roundNumber: 3,
            action: "REVELAR_PRESENTES",
            operator: "Diego",
            reason: "Jurado 3 sin conexión",
          },
        ],
      }),
    );
    expect(view?.log[0]).toMatchObject({ label: "Cerró el mercado", operator: "Diego", time: "15:08:00" });
    expect(view?.log[1]).toMatchObject({
      label: "Reveló con los jurados presentes",
      reason: "Jurado 3 sin conexión",
    });
  });
});
