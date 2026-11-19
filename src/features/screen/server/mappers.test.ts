import { describe, expect, it } from "vitest";
import type { RoundRow, RoundVoteRow } from "@/server/db/rounds";
import { buildScreen, type ScreenData } from "./mappers";

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
  return { rounds, votes: [], ranking: [], activeUsers: 0, ...extra };
}

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
    const vm = buildScreen(screen([voting], { votes }), NOW);

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

  it("muestra la espera previa cuando ninguna ronda ha iniciado", () => {
    const first = round({ numero: 1, estado: "SCHEDULED", startup_nombre: "Aqua Viva" });
    const second = round({ numero: 2, estado: "SCHEDULED", startup_nombre: "Huella" });
    const vm = buildScreen(screen([second, first]), NOW);

    expect(vm).toMatchObject({
      phase: "WAITING",
      updatedAt: NOW.toISOString(),
      nextRound: { number: 1, startup: { name: "Aqua Viva", sdg: { number: 6 } } },
    });
  });

  it("no muestra la espera una vez iniciada la primera ronda", () => {
    const open = round({ numero: 1, estado: "OPEN" });
    const next = round({ numero: 2, estado: "SCHEDULED" });

    expect(buildScreen(screen([open, next]), NOW)).toMatchObject({ phase: "MARKET" });
  });
});
