import { describe, expect, it } from "vitest";
import {
  buildScreen,
  buildJuryView,
  buildOperatorView,
  parseSdg,
  operatorReferenceRound,
  type JuryData,
  type OperatorData,
  type ScreenData,
  type RoundRow,
  type RoundVoteRow,
} from "./mapeo";

const NOW = new Date("2026-11-08T15:00:00.000Z");

/** Fila de ronda con valores por defecto que cada prueba sobrescribe. */
function round(partial: Partial<RoundRow> & Pick<RoundRow, "numero" | "estado">): RoundRow {
  return {
    id_ronda: String(partial.numero),
    multiplicador: null,
    segundos_ultima_llamada: null,
    startup_nombre: `Startup ${partial.numero}`,
    ods: "ODS 6",
    monto_acumulado: "0",
    inversores_unicos: 0,
    precio_vivo: "100",
    fraccion_respaldo: null,
    puntaje: null,
    monto_invertido: "0",
    retorno_ronda: "0",
    ...partial,
  };
}

function vote(id: string, name: string, decision: RoundVoteRow["decision"]): RoundVoteRow {
  return { id_jurado: id, nombre: name, decision };
}

const COMPLETE_VOTES: RoundVoteRow[] = [
  vote("1", "Jurado 1", "BACK"),
  vote("2", "Jurado 2", "BACK"),
  vote("3", "Jurado 3", "REJECT"),
  vote("4", "Jurado 4", "ABSTAIN"),
];

function screen(
  rounds: RoundRow[],
  extra: Partial<ScreenData> = {},
): ScreenData {
  return { rounds: rounds, votes: [], ranking: [], activeUsers: 0, ...extra };
}

describe("parsearOds", () => {
  it("extrae el número y el nombre oficial del ODS", () => {
    expect(parseSdg("ODS 6")).toEqual({
      number: 6,
      name: "Agua limpia y saneamiento",
    });
  });

  it("devuelve número cero y nombre vacío cuando el texto no contiene un ODS", () => {
    expect(parseSdg(null)).toEqual({ number: 0, name: "" });
  });
});

describe("buildScreen", () => {
  it("devuelve nulo cuando el evento no tiene rondas", () => {
    expect(buildScreen(screen([]), NOW)).toBeNull();
  });

  it("muestra el mercado con precio, acumulado e inversores de la ronda abierta", () => {
    const openRound = round({
      numero: 1,
      estado: "OPEN",
      precio_vivo: "148.50",
      monto_acumulado: "9500",
      inversores_unicos: 31,
    });
    const vm = buildScreen(screen([openRound]), NOW);

    expect(vm).toMatchObject({
      phase: "MARKET",
      updatedAt: NOW.toISOString(),
      price: 148.5,
      accumulated: 9500,
      uniqueInvestors: 31,
      round: { number: 1, startup: { name: "Startup 1", sdg: { number: 6 } } },
    });
  });

  it("calcula la cuenta regresiva de la última llamada sin bajar de cero", () => {
    const running = round({ numero: 2, estado: "LAST_CALL", segundos_ultima_llamada: 15 });
    const expired = round({ numero: 2, estado: "LAST_CALL", segundos_ultima_llamada: 90 });

    expect(buildScreen(screen([running]), NOW)).toMatchObject({
      phase: "LAST_CALL",
      secondsRemaining: 45,
    });
    expect(buildScreen(screen([expired]), NOW)).toMatchObject({
      secondsRemaining: 0,
    });
  });

  it("no revela el sentido de los votos durante la votación", () => {
    const voting = round({ numero: 2, estado: "VOTING" });
    const votes = [
      vote("1", "Jurado 1", "BACK"),
      vote("2", "Jurado 2", null),
      vote("3", "Jurado 3", null),
      vote("4", "Jurado 4", null),
    ];
    const vm = buildScreen(screen([voting], { votes: votes }), NOW);

    expect(vm).toMatchObject({ phase: "VOTING", votesCast: 1, jurorsTotal: 4 });
    expect(JSON.stringify(vm)).not.toContain("BACK");
  });

  it("revela los cuatro votos y el multiplicador en la liquidación", () => {
    const settledRound = round({
      numero: 1,
      estado: "SETTLED",
      multiplicador: "1.400",
      fraccion_respaldo: "0.6667",
      monto_invertido: "7500",
      retorno_ronda: "10500",
    });
    const pending = round({ numero: 2, estado: "SCHEDULED" });
    const vm = buildScreen(
      screen([settledRound, pending], { votes: COMPLETE_VOTES }),
      NOW,
    );

    expect(vm).toMatchObject({
      phase: "SETTLEMENT",
      multiplier: 1.4,
      backingFraction: 0.6667,
      amountInvested: 7500,
      roundReturn: 10500,
    });
    expect(vm?.phase === "SETTLEMENT" ? vm.votes : []).toEqual([
      { juror: "Jurado 1", decision: "BACK" },
      { juror: "Jurado 2", decision: "BACK" },
      { juror: "Jurado 3", decision: "REJECT" },
      { juror: "Jurado 4", decision: "ABSTAIN" },
    ]);
  });

  it("muestra el leaderboard entre rondas con las startups ordenadas por acumulado", () => {
    const cancelledRound = round({ numero: 1, estado: "CANCELLED", multiplicador: "1.0" });
    const pending = round({ numero: 2, estado: "SCHEDULED", monto_acumulado: "4000" });
    const other = round({ numero: 3, estado: "SCHEDULED", monto_acumulado: "9000" });
    const ranking = [
      { id_usuario: "1", nombre: "Ana", posicion: 1, saldo: "12000", aciertos: 2 },
      { id_usuario: "2", nombre: "Luis", posicion: 2, saldo: "9500", aciertos: 1 },
    ];
    const vm = buildScreen(screen([cancelledRound, pending, other], { ranking }), NOW);

    expect(vm).toMatchObject({ phase: "BETWEEN_ROUNDS", closedRound: { number: 1 } });
    if (vm?.phase !== "BETWEEN_ROUNDS") throw new Error("Fase inesperada");
    expect(vm.investors).toEqual([
      { position: 1, name: "Ana", balance: 12000 },
      { position: 2, name: "Luis", balance: 9500 },
    ]);
    expect(vm.startups.map((s) => s.name)).toEqual(["Startup 3", "Startup 2", "Startup 1"]);
    expect(vm.startups.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it("declara la ganadora, el top 3 y el mejor ojo al cerrar el evento", () => {
    const rounds = [
      round({
        numero: 1,
        estado: "SETTLED",
        fraccion_respaldo: "0.7500",
        puntaje: "0.6900",
        inversores_unicos: 6,
        startup_nombre: "AgroSense",
        ods: "ODS 2",
      }),
      round({
        numero: 2,
        estado: "SETTLED",
        fraccion_respaldo: "0.5000",
        puntaje: "0.3800",
        inversores_unicos: 2,
        startup_nombre: "AguaClara",
      }),
    ];
    const ranking = [
      { id_usuario: "1", nombre: "Ana", posicion: 1, saldo: "18400", aciertos: 3 },
      { id_usuario: "2", nombre: "Luis", posicion: 2, saldo: "17900", aciertos: 5 },
      { id_usuario: "3", nombre: "Eva", posicion: 3, saldo: "16200", aciertos: 1 },
      { id_usuario: "4", nombre: "Rosa", posicion: 4, saldo: "15000", aciertos: 0 },
    ];
    const vm = buildScreen(
      screen(rounds, { ranking, activeUsers: 10 }),
      NOW,
    );

    if (vm?.phase !== "CLOSING") throw new Error("Fase inesperada");
    expect(vm.winner.name).toBe("AgroSense");
    expect(vm.winner.sdg).toEqual({ number: 2, name: "Hambre cero" });
    expect(vm.winner.investorPercentage).toBeCloseTo(0.6);
    expect(vm.winner.score).toBeCloseTo(0.6 * 0.75 + 0.4 * 0.6);
    expect(vm.top3.map((f) => f.name)).toEqual(["Ana", "Luis", "Eva"]);
    expect(vm.bestEye).toEqual({ name: "Luis", hits: 5 });
  });
});

describe("buildJuryView", () => {
  const base: Omit<JuryData, "rounds" | "votes"> = {
    jurorId: "2",
    name: "Jurado de ejemplo 2",
    totalJurors: 4,
  };

  it("muestra la espera cuando no hay ronda activa", () => {
    const vm = buildJuryView({
      ...base,
      rounds: [round({ numero: 1, estado: "SCHEDULED" })],
      votes: [],
    });
    expect(vm).toMatchObject({ screen: "waiting", round: null, jurorLabel: "Jurado de ejemplo 2" });
  });

  it("muestra la votación hasta que el jurado registra su voto", () => {
    const rounds = [round({ numero: 3, estado: "VOTING", startup_nombre: "EduRuta" })];
    const noVote = buildJuryView({
      ...base,
      rounds: rounds,
      votes: [vote("2", "Jurado de ejemplo 2", null), vote("1", "Jurado de ejemplo 1", "BACK")],
    });
    const conVoto = buildJuryView({
      ...base,
      rounds: rounds,
      votes: [vote("2", "Jurado de ejemplo 2", "REJECT"), vote("1", "Jurado de ejemplo 1", "BACK")],
    });

    expect(noVote).toMatchObject({
      screen: "voting",
      round: { number: 3, startupName: "EduRuta" },
      votes: { emitted: 1, total: 4 },
    });
    expect(conVoto).toMatchObject({ screen: "vote_registered", votes: { emitted: 2, total: 4 } });
  });

  it("no expone el sentido de los votos de otros jurados", () => {
    const vm = buildJuryView({
      ...base,
      rounds: [round({ numero: 3, estado: "VOTING" })],
      votes: [vote("1", "Jurado de ejemplo 1", "BACK"), vote("2", "Jurado de ejemplo 2", null)],
    });
    expect(JSON.stringify(vm)).not.toContain("BACK");
  });
});

describe("buildOperatorView", () => {
  function operator(
    rounds: RoundRow[],
    extra: Partial<OperatorData> = {},
  ): OperatorData {
    return {
      rounds: rounds,
      votes: [],
      cancelAction: null,
      activeUsers: 0,
      balances: [],
      positions: [],
      actions: [],
      now: NOW,
      ...extra,
    };
  }

  it("devuelve nulo cuando no hay rondas", () => {
    expect(buildOperatorView(operator([]))).toBeNull();
  });

  it("habilita la última llamada con la ronda abierta y mantiene bloqueado el veredicto", () => {
    const vm = buildOperatorView(operator([round({ numero: 1, estado: "OPEN" })]));
    const actions = Object.fromEntries((vm?.actions ?? []).map((a) => [a.id, a]));

    expect(actions.last_call).toMatchObject({ enabled: true, done: false });
    expect(actions.close).toMatchObject({ enabled: true, done: false });
    expect(actions.open).toMatchObject({ enabled: false, done: true });
    expect(actions.reveal).toMatchObject({ enabled: false, done: false });
    expect(vm?.canCancel).toBe(true);
  });

  it("indica cuántos votos faltan antes de revelar", () => {
    const vm = buildOperatorView(
      operator([round({ numero: 2, estado: "VOTING" })], {
        votes: [
          vote("1", "Jurado 1", "BACK"),
          vote("2", "Jurado 2", "BACK"),
          vote("3", "Jurado 3", "REJECT"),
          vote("4", "Jurado 4", null),
        ],
      }),
    );
    const revelar = vm?.actions.find((a) => a.id === "reveal");

    expect(revelar).toMatchObject({ enabled: false, blockedReason: "Faltan 1 voto(s)" });
    expect(vm?.jurors.map((j) => j.sense)).toEqual([null, null, null, null]);
  });

  it("revela el sentido de los votos solo cuando la ronda está liquidada", () => {
    const vm = buildOperatorView(
      operator([round({ numero: 1, estado: "SETTLED", multiplicador: "1.4" })], {
        votes: COMPLETE_VOTES,
      }),
    );

    expect(vm?.jurors.map((j) => j.sense)).toEqual([
      "backs",
      "backs",
      "rejects",
      "abstains",
    ]);
    expect(vm?.round.multiplier).toBe(1.4);
  });

  it("identifica el modo de anulación registrado para la ronda", () => {
    const vm = buildOperatorView(
      operator([round({ numero: 4, estado: "CANCELLED", multiplicador: "1.0" })], {
        cancelAction: "CANCEL_SETTLE_1X",
      }),
    );
    expect(vm?.round.cancelMode).toBe("settle_1x");
  });

  it("muestra la siguiente ronda programada una vez liquidada la anterior", () => {
    const rounds = [
      round({ numero: 1, estado: "SETTLED" }),
      round({ numero: 2, estado: "SCHEDULED", startup_nombre: "SolRed" }),
    ];
    expect(operatorReferenceRound(rounds)?.numero).toBe(2);
  });

  it("deja el retorno nulo mientras la posición no esté liquidada", () => {
    const vm = buildOperatorView(
      operator([round({ numero: 1, estado: "OPEN" })], {
        positions: [
          { id_usuario: "5", nombre: "Ana", numero: 1, startup_nombre: "Startup 1", monto: "2000", retorno: null },
          { id_usuario: "5", nombre: "Ana", numero: 2, startup_nombre: "Startup 2", monto: "500", retorno: "700" },
        ],
      }),
    );
    expect(vm?.positions.map((p) => p.returnAmount)).toEqual([null, 700]);
  });
});
