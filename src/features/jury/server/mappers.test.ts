import { describe, expect, it } from "vitest";
import type { RoundRow, RoundVoteRow } from "@/server/db/rounds";
import type { RoundState } from "@/shared/domain/types";
import { buildJuryView, resolveCurrentRound, type JuryData } from "./mappers";

/** Fila de ronda con valores por defecto que cada prueba sobrescribe. */
function round(
  partial: Partial<RoundRow> & Pick<RoundRow, "numero" | "estado">,
): RoundRow {
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

/** Lista de cinco rondas con el estado indicado para cada número, en orden. */
function event(states: readonly RoundState[]): RoundRow[] {
  return states.map((estado, index) => round({ numero: index + 1, estado }));
}

function vote(id: string, name: string, decision: RoundVoteRow["decision"]): RoundVoteRow {
  return { id_jurado: id, nombre: name, decision };
}

describe("resolveCurrentRound", () => {
  it("prioriza la ronda en curso sobre las demás", () => {
    const current = resolveCurrentRound(
      event(["SETTLED", "LAST_CALL", "SCHEDULED", "SCHEDULED", "SCHEDULED"]),
    );
    expect(current).toMatchObject({ phase: "last_call" });
    expect(current.row?.numero).toBe(2);
  });

  it("mantiene visible la última ronda liquidada hasta que se abre la siguiente", () => {
    const current = resolveCurrentRound(
      event(["SETTLED", "SCHEDULED", "SCHEDULED", "SCHEDULED", "SCHEDULED"]),
    );
    expect(current).toMatchObject({ phase: "result" });
    expect(current.row?.numero).toBe(1);
  });

  it("muestra la primera ronda pendiente cuando aún no hay ronda terminada", () => {
    const current = resolveCurrentRound(event(["SCHEDULED", "SCHEDULED"]));
    expect(current).toMatchObject({ phase: "scheduled" });
    expect(current.row?.numero).toBe(1);
  });

  it("indica el evento final cuando no hay rondas", () => {
    expect(resolveCurrentRound([])).toEqual({ row: undefined, phase: "final" });
  });

  it.each([
    ["OPEN", "open"],
    ["LAST_CALL", "last_call"],
    ["CLOSED", "closed"],
    ["VOTING", "voting"],
    ["SETTLED", "result"],
    ["CANCELLED", "cancelled"],
  ] as const)("traduce el estado %s a la fase %s", (estado, phase) => {
    expect(resolveCurrentRound(event([estado])).phase).toBe(phase);
  });
});

describe("buildJuryView", () => {
  const base: Omit<JuryData, "rounds" | "votes" | "ownVotes" | "description"> = {
    jurorId: "2",
    name: "Jurado de ejemplo 2",
    totalJurors: 4,
  };

  it("muestra la espera con la ronda pendiente cuando aún no inicia", () => {
    const vm = buildJuryView({
      ...base,
      rounds: event(["SCHEDULED", "SCHEDULED"]),
      votes: [],
      ownVotes: [],
      description: null,
    });
    expect(vm).toMatchObject({
      screen: "waiting",
      phase: "scheduled",
      jurorLabel: "Jurado de ejemplo 2",
      round: { number: 1, total: 2 },
    });
  });

  it("indica el evento final sin ronda cuando no hay rondas", () => {
    const vm = buildJuryView({
      ...base,
      rounds: [],
      votes: [],
      ownVotes: [],
      description: null,
    });
    expect(vm).toMatchObject({ screen: "waiting", phase: "final", round: null });
  });

  it("muestra la votación hasta que el jurado registra su voto", () => {
    const rounds = [round({ numero: 3, estado: "VOTING", startup_nombre: "EduRuta" })];
    const noVote = buildJuryView({
      ...base,
      rounds,
      votes: [vote("2", "Jurado de ejemplo 2", null), vote("1", "Jurado de ejemplo 1", "BACK")],
      ownVotes: [],
      description: "Rutas de aprendizaje.",
    });
    const withVote = buildJuryView({
      ...base,
      rounds,
      votes: [vote("2", "Jurado de ejemplo 2", "REJECT"), vote("1", "Jurado de ejemplo 1", "BACK")],
      ownVotes: [],
      description: "Rutas de aprendizaje.",
    });

    expect(noVote).toMatchObject({
      screen: "voting",
      ownVote: null,
      round: { number: 3, total: 1, startupName: "EduRuta", description: "Rutas de aprendizaje." },
      votes: { emitted: 1, total: 4 },
    });
    expect(withVote).toMatchObject({
      screen: "vote_registered",
      ownVote: "REJECT",
      votes: { emitted: 2, total: 4 },
    });
  });

  it("no expone el sentido de los votos de otros jurados durante la votación", () => {
    const vm = buildJuryView({
      ...base,
      rounds: [round({ numero: 3, estado: "VOTING" })],
      votes: [vote("1", "Jurado de ejemplo 1", "BACK"), vote("2", "Jurado de ejemplo 2", null)],
      ownVotes: [],
      description: null,
    });
    expect(vm.reveal).toBeNull();
    expect(JSON.stringify(vm)).not.toContain("BACK");
  });

  it("publica los votos y el multiplicador al liquidar la ronda", () => {
    const rounds = event(["SETTLED", "SETTLED", "SETTLED", "SETTLED", "SETTLED"]);
    rounds[4] = { ...rounds[4], multiplicador: "1.35" };
    const vm = buildJuryView({
      ...base,
      rounds,
      votes: [
        vote("1", "Jurado de ejemplo 1", "BACK"),
        vote("2", "Jurado de ejemplo 2", "REJECT"),
        vote("3", "Jurado de ejemplo 3", "ABSTAIN"),
      ],
      ownVotes: [{ id_ronda: "5", decision: "REJECT" }],
      description: null,
    });

    expect(vm.screen).toBe("result");
    expect(vm.reveal).toEqual({
      multiplier: 1.35,
      isLastRound: true,
      votes: [
        { label: "Jurado 1", isOwn: false, decision: "BACK" },
        { label: "Jurado 2", isOwn: true, decision: "REJECT" },
        { label: "Jurado 3", isOwn: false, decision: "ABSTAIN" },
      ],
    });
  });

  it("construye el recorrido con el voto propio de las rondas terminadas", () => {
    const vm = buildJuryView({
      ...base,
      rounds: [
        round({ numero: 1, estado: "SETTLED", startup_nombre: "AgroSense" }),
        round({ numero: 2, estado: "CANCELLED", startup_nombre: "AguaClara" }),
        round({ numero: 3, estado: "VOTING", startup_nombre: "EduRuta" }),
        round({ numero: 4, estado: "SCHEDULED", startup_nombre: "SolRed" }),
      ],
      votes: [vote("2", "Jurado de ejemplo 2", null)],
      ownVotes: [
        { id_ronda: "1", decision: "BACK" },
        { id_ronda: "2", decision: "ABSTAIN" },
      ],
      description: null,
    });

    expect(vm.rail).toEqual([
      { number: 1, startupName: "AgroSense", status: "settled", ownDecision: "BACK" },
      { number: 2, startupName: "AguaClara", status: "settled", ownDecision: "ABSTAIN" },
      { number: 3, startupName: "EduRuta", status: "current", ownDecision: null },
      { number: 4, startupName: "SolRed", status: "pending", ownDecision: null },
    ]);
  });
});
