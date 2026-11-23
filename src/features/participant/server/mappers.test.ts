import { describe, expect, it } from "vitest";
import {
  buildParticipantState,
  type ParticipantLeaderboardRow,
  type ParticipantRoundRow,
  type ParticipantStateData,
} from "./mappers";

const NOW = new Date("2026-11-26T20:00:00.000Z");

/** Fila de ronda con valores por defecto; cada prueba sobrescribe solo lo que necesita. */
function round(
  number: number,
  state: ParticipantRoundRow["estado"],
  extra: Partial<ParticipantRoundRow> = {},
): ParticipantRoundRow {
  return {
    id_ronda: String(number),
    numero: number,
    estado: state,
    multiplicador: null,
    fase_termina_en: null,
    segundos_restantes_pausa: null,
    liquidada_en: null,
    startup_nombre: "AgroSense",
    ods: "ODS 2",
    descripcion: "Descripción de prueba",
    logo_url: null,
    monto_acumulado: "0",
    inversores_unicos: 0,
    precio_vivo: "100.00",
    puntaje_jurado: null,
    ...extra,
  };
}

function row(id: number, position: number, balance: number, hits = 0): ParticipantLeaderboardRow {
  return { id_usuario: String(id), nombre: `Asistente ${id}`, posicion: position, saldo: String(balance), aciertos: hits };
}

/** Datos base del inversionista (id 7) con saldo de 10,000 y sin inversiones. */
function data(extra: Partial<ParticipantStateData>): ParticipantStateData {
  return {
    userId: 7,
    balance: 10_000,
    rounds: [],
    investments: [],
    topThreeRows: [],
    windowRows: [],
    ownRow: null,
    participants: 0,
    previousPositions: new Map(),
    settledAtOneRoundIds: [],
    winnerStartup: null,
    now: NOW,
    ...extra,
  };
}

const scheduledRounds = [round(1, "SCHEDULED"), round(2, "SCHEDULED"), round(3, "SCHEDULED")];

describe("buildParticipantState", () => {
  it("arma la fase programada con tope de 30 % del saldo y sin reloj", () => {
    const vm = buildParticipantState(data({ rounds: scheduledRounds }));

    expect(vm).toMatchObject({
      phase: "scheduled",
      round: { number: 1, total: 3 },
      startup: { name: "AgroSense", sdg: "ODS 2 · Hambre cero", logoUrl: null },
      wallet: { balance: 10_000, investedInRound: 0, roundCap: 3_000, alreadyInvested: false },
      market: null,
      clock: null,
      verdict: null,
      standing: null,
      winnerStartup: null,
    });
  });

  it("entrega el reloj de la fase con la hora del servidor y la pausa", () => {
    const open = round(1, "OPEN", { fase_termina_en: "2026-11-26T20:10:00.000Z" });
    expect(buildParticipantState(data({ rounds: [open] })).clock).toEqual({
      serverTime: NOW.toISOString(),
      phaseEndsAt: "2026-11-26T20:10:00.000Z",
      paused: false,
      pausedSeconds: null,
    });

    const paused = round(1, "LAST_CALL", { segundos_restantes_pausa: 42 });
    const vm = buildParticipantState(data({ rounds: [paused] }));
    expect(vm.phase).toBe("lastCall");
    expect(vm.clock).toMatchObject({ paused: true, pausedSeconds: 42, phaseEndsAt: null });
  });

  it("marca la ronda como invertida y calcula el tope con el saldo de entrada", () => {
    const vm = buildParticipantState(
      data({
        balance: 9_000,
        rounds: [round(1, "OPEN")],
        investments: [{ id_ronda: "1", monto: "1000", retorno: "0" }],
      }),
    );
    expect(vm.wallet).toEqual({ balance: 9_000, investedInRound: 1_000, roundCap: 3_000, alreadyInvested: true });
  });

  it("muestra el veredicto con el puntaje en porcentaje y la hora de liquidación", () => {
    const settled = round(1, "SETTLED", {
      multiplicador: "1.400",
      puntaje_jurado: "4.0000",
      liquidada_en: "2026-11-26T20:20:00.000Z",
    });
    const vm = buildParticipantState(
      data({
        balance: 10_400,
        rounds: [settled, round(2, "SCHEDULED")],
        investments: [{ id_ronda: "1", monto: "1000", retorno: "1400" }],
      }),
    );

    expect(vm.phase).toBe("result");
    expect(vm.verdict).toEqual({
      juryScore: 4,
      scorePct: 75,
      multiplier: 1.4,
      invested: 1_000,
      payout: 1_400,
      gain: 400,
      annulment: null,
      settledAt: "2026-11-26T20:20:00.000Z",
    });
  });

  it("oculta el puntaje en una ronda anulada", () => {
    const vm = buildParticipantState(
      data({ rounds: [round(1, "CANCELLED", { multiplicador: "1.000" }), round(2, "SCHEDULED")] }),
    );
    expect(vm.verdict).toMatchObject({ annulment: "refund", juryScore: null, scorePct: null });
  });

  it("arma la clasificación con vecinos, distancias, movimiento y racha", () => {
    const rounds = [
      round(1, "SETTLED", { multiplicador: "1.400" }),
      round(2, "SETTLED", { multiplicador: "1.200" }),
      round(3, "SCHEDULED"),
    ];
    const own = row(7, 5, 10_600, 2);
    const vm = buildParticipantState(
      data({
        balance: 10_600,
        rounds,
        investments: [
          { id_ronda: "1", monto: "500", retorno: "700" },
          { id_ronda: "2", monto: "500", retorno: "600" },
        ],
        topThreeRows: [row(1, 1, 12_000), row(2, 2, 11_500), row(3, 3, 11_000)],
        windowRows: [row(3, 3, 11_000), row(4, 4, 10_800), own, row(8, 6, 10_500), row(9, 7, 10_400)],
        ownRow: own,
        participants: 40,
        previousPositions: new Map([
          ["7", 8],
          ["4", 4],
        ]),
      }),
    );

    expect(vm.standing).toMatchObject({
      position: 5,
      previousPosition: 8,
      participants: 40,
      hits: 2,
      hitsTotal: 2,
      streak: 2,
      distanceToFirst: 1_400,
      distanceToPodium: 400,
    });
    expect(vm.standing?.window.map((entry) => [entry.position, entry.name, entry.previousPosition])).toEqual([
      [3, "Asistente 3", null],
      [4, "Asistente 4", 4],
      [5, "Tú", 8],
      [6, "Asistente 8", null],
      [7, "Asistente 9", null],
    ]);
  });

  it("corta la racha en la última ronda sin acierto", () => {
    const vm = buildParticipantState(
      data({
        rounds: [
          round(1, "SETTLED", { multiplicador: "1.400" }),
          round(2, "SETTLED", { multiplicador: "0.600" }),
          round(3, "SCHEDULED"),
        ],
        investments: [
          { id_ronda: "1", monto: "500", retorno: "700" },
          { id_ronda: "2", monto: "500", retorno: "300" },
        ],
      }),
    );
    expect(vm.standing?.streak).toBe(0);
  });

  it("muestra el cierre del evento con la startup ganadora", () => {
    const vm = buildParticipantState(
      data({ rounds: [round(1, "SETTLED", { multiplicador: "1.000" })], winnerStartup: "AgroSense" }),
    );
    expect(vm.phase).toBe("final");
    expect(vm.winnerStartup).toBe("AgroSense");
  });
});
