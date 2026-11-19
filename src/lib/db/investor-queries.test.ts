import { beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({ sql: sqlMock }));

import {
  buildParticipantState,
  type ParticipantStateData,
  type ParticipantRoundRow,
  registerInvestment,
} from "./investor-queries";

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
    segundos_ultima_llamada: null,
    startup_nombre: "AgroSense",
    ods: "ODS 2",
    descripcion: "Descripción de prueba",
    monto_acumulado: "0",
    inversores_unicos: 0,
    precio_vivo: "100.00",
    ...extra,
  };
}

/** Datos base del inversionista con saldo de 10,000 y sin inversiones. */
function data(extra: Partial<ParticipantStateData>): ParticipantStateData {
  return {
    userId: 7,
    balance: 10_000,
    rounds: [],
    investments: [],
    lastDecisions: [],
    topThreeRows: [],
    ownRow: null,
    participants: 0,
    previousPosition: null,
    ...extra,
  };
}

const scheduledRounds = [round(1, "SCHEDULED"), round(2, "SCHEDULED"), round(3, "SCHEDULED")];

beforeEach(() => {
  sqlMock.mockReset();
});

describe("construirEstadoInversionista", () => {
  it("arma la fase programada con tope de 30 % del saldo y sin mercado ni veredicto", () => {
    const vm = buildParticipantState(data({ rounds: scheduledRounds }));

    expect(vm).toEqual({
      phase: "scheduled",
      round: { number: 1, total: 3 },
      startup: { name: "AgroSense", sdg: "ODS 2 · Hambre cero", description: "Descripción de prueba" },
      wallet: { balance: 10_000, investedInRound: 0, roundCap: 3_000 },
      market: null,
      countdownSeconds: null,
      verdict: null,
      standing: null,
    });
  });

  it("calcula el tope con el saldo al abrir la ronda y expone el mercado en fase abierta", () => {
    const vm = buildParticipantState(
      data({
        balance: 9_500,
        rounds: [
          round(1, "OPEN", { monto_acumulado: "4000", precio_vivo: "120.00", inversores_unicos: 18 }),
          round(2, "SCHEDULED"),
        ],
        investments: [{ id_ronda: "1", monto: "500", retorno: "0" }],
      }),
    );

    expect(vm.phase).toBe("open");
    expect(vm.wallet).toEqual({ balance: 9_500, investedInRound: 500, roundCap: 3_000 });
    expect(vm.market).toEqual({ price: 120, priceChange: 20, totalRaised: 4_000, investorCount: 18 });
    expect(vm.countdownSeconds).toBeNull();
    expect(vm.verdict).toBeNull();
    expect(vm.standing).toBeNull();
  });

  it("informa los segundos restantes de la última llamada sin bajar de cero", () => {
    const inLastCall = buildParticipantState(
      data({ rounds: [round(1, "LAST_CALL", { segundos_ultima_llamada: 20.7 })] }),
    );
    const expired = buildParticipantState(
      data({ rounds: [round(1, "LAST_CALL", { segundos_ultima_llamada: 75 })] }),
    );

    expect(inLastCall.phase).toBe("lastCall");
    expect(inLastCall.countdownSeconds).toBe(40);
    expect(expired.countdownSeconds).toBe(0);
  });

  it("oculta el mercado durante la votación", () => {
    const vm = buildParticipantState(data({ rounds: [round(1, "VOTING")] }));

    expect(vm.phase).toBe("voting");
    expect(vm.market).toBeNull();
    expect(vm.standing).toBeNull();
  });

  it("arma veredicto y clasificación tras liquidar, con la posición propia", () => {
    const vm = buildParticipantState(
      data({
        balance: 10_200,
        rounds: [round(1, "SETTLED", { multiplicador: "1.400" }), round(2, "SCHEDULED")],
        investments: [{ id_ronda: "1", monto: "500", retorno: "700" }],
        lastDecisions: ["BACK", "BACK", "BACK", "REJECT"],
        topThreeRows: [
          { id_usuario: "1", nombre: "Sofía", posicion: 1, saldo: "12000.00", aciertos: 2 },
          { id_usuario: "2", nombre: "Carlos", posicion: 2, saldo: "11000.00", aciertos: 1 },
          { id_usuario: "3", nombre: "Lucía", posicion: 3, saldo: "10900.00", aciertos: 1 },
        ],
        ownRow: { id_usuario: "7", nombre: "Ana", posicion: 4, saldo: "10200.00", aciertos: 1 },
        participants: 74,
        previousPosition: 6,
      }),
    );

    expect(vm.phase).toBe("result");
    expect(vm.round).toEqual({ number: 1, total: 2 });
    expect(vm.wallet).toEqual({ balance: 10_200, investedInRound: 500, roundCap: 3_000 });
    expect(vm.verdict).toEqual({
      decisions: ["BACK", "BACK", "BACK", "REJECT"],
      backs: 3,
      voters: 4,
      multiplier: 1.4,
      invested: 500,
      payout: 700,
      gain: 200,
    });
    expect(vm.standing).toEqual({
      position: 4,
      previousPosition: 6,
      participants: 74,
      hits: 1,
      hitsTotal: 1,
      topThree: [
        { position: 1, name: "Sofía", balance: 12_000, isCurrent: false },
        { position: 2, name: "Carlos", balance: 11_000, isCurrent: false },
        { position: 3, name: "Lucía", balance: 10_900, isCurrent: false },
      ],
      me: { position: 4, name: "Tú", balance: 10_200, isCurrent: true },
    });
  });

  it("pasa a la fase final cuando no quedan rondas por abrir", () => {
    const vm = buildParticipantState(
      data({
        rounds: [round(1, "SETTLED", { multiplicador: "0.200" })],
        investments: [{ id_ronda: "1", monto: "300", retorno: "60" }],
        lastDecisions: ["REJECT", "REJECT", "REJECT", "REJECT"],
        ownRow: { id_usuario: "7", nombre: "Ana", posicion: 1, saldo: "9760.00", aciertos: 0 },
        participants: 1,
      }),
    );

    expect(vm.phase).toBe("final");
    expect(vm.round).toEqual({ number: 1, total: 1 });
    expect(vm.standing?.previousPosition).toBe(1);
    expect(vm.standing?.hitsTotal).toBe(1);
  });

  it("conserva la forma completa del view model en todas las fases", () => {
    const vm = buildParticipantState(data({ rounds: scheduledRounds }));

    expect(Object.keys(vm).sort()).toEqual(
      [
        "countdownSeconds",
        "market",
        "phase",
        "round",
        "standing",
        "startup",
        "verdict",
        "wallet",
      ].sort(),
    );
  });
});

describe("registrarInversion", () => {
  it("devuelve RONDA_NO_ABIERTA sin invocar la función cuando no hay ronda abierta", async () => {
    sqlMock.mockResolvedValueOnce([]);

    const result = await registerInvestment(7, 300);

    expect(result).toEqual({ ok: false, error: "ROUND_NOT_OPEN" });
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("invoca fn_registrar_inversion con el usuario recibido y devuelve el resultado de la función", async () => {
    sqlMock
      .mockResolvedValueOnce([{ id_ronda: "3" }])
      .mockResolvedValueOnce([{ resultado: { ok: false, error: "ROUND_CAP_EXCEEDED", saldo: 9000 } }]);

    const result = await registerInvestment(7, 300);

    expect(result).toEqual({ ok: false, error: "ROUND_CAP_EXCEEDED", saldo: 9000 });
    const [functionText, ...parameters] = sqlMock.mock.calls[1] as [TemplateStringsArray, ...unknown[]];
    expect(functionText.join("?")).toContain("fn_registrar_inversion");
    expect(parameters).toEqual([7, "3", 300]);
  });
});
