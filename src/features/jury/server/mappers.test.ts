import { describe, expect, it } from "vitest";
import type { RoundRow, RoundVoteRow } from "@/server/db/rounds";
import type { RoundState } from "@/shared/domain/types";
import { DEFAULT_JURY_CRITERIA } from "../criteria";
import { buildJuryView, resolveCurrentRound, type JuryData } from "./mappers";

/** Fila de ronda con valores por defecto que cada prueba sobrescribe. */
function round(
  partial: Partial<RoundRow> & Pick<RoundRow, "numero" | "estado">,
): RoundRow {
  return {
    id_ronda: String(partial.numero),
    multiplicador: null,
    segundos_ultima_llamada: null,
    fase_termina_en: null,
    segundos_restantes_pausa: null,
    liquidada_en: null,
    puntaje_jurado: null,
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

function vote(
  id: string,
  name: string,
  options: { enviado: boolean; se_abstiene?: boolean; puntaje?: string | null },
): RoundVoteRow {
  return {
    id_jurado: id,
    nombre: name,
    enviado: options.enviado,
    se_abstiene: options.se_abstiene ?? false,
    puntaje: options.puntaje ?? null,
    decision: null,
  };
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
  const base: Pick<JuryData, "jurorId" | "name" | "criteria" | "totalJurors"> = {
    jurorId: "2",
    name: "Jurado de ejemplo 2",
    criteria: DEFAULT_JURY_CRITERIA,
    totalJurors: 4,
  };

  it("muestra la espera con la ronda pendiente cuando aún no inicia", () => {
    const vm = buildJuryView({
      ...base,
      rounds: event(["SCHEDULED", "SCHEDULED"]),
      votes: [],
      ownVerdicts: [],
      draftNotes: [],
      ownRoundNotes: [],
      revealedNotes: [],
      description: null,
    });
    expect(vm).toMatchObject({
      screen: "waiting",
      phase: "scheduled",
      jurorLabel: "Jurado de ejemplo 2",
      round: { id: "1", number: 1, total: 2 },
    });
  });

  it("indica el evento final sin ronda cuando no hay rondas", () => {
    const vm = buildJuryView({
      ...base,
      rounds: [],
      votes: [],
      ownVerdicts: [],
      draftNotes: [],
      ownRoundNotes: [],
      revealedNotes: [],
      description: null,
    });
    expect(vm).toMatchObject({ screen: "waiting", phase: "final", round: null });
  });

  it("muestra la grilla con el borrador recuperado mientras la ronda es calificable", () => {
    const vm = buildJuryView({
      ...base,
      rounds: [round({ numero: 2, estado: "OPEN", startup_nombre: "AguaClara" })],
      votes: [],
      ownVerdicts: [],
      draftNotes: [
        { id_criterio: "1", valor: 4 },
        { id_criterio: "3", valor: 5 },
      ],
      ownRoundNotes: [],
      revealedNotes: [],
      description: "Filtros comunitarios.",
      logoUrl: "https://example.test/agua.png",
    });

    expect(vm.screen).toBe("grading");
    expect(vm.phase).toBe("open");
    expect(vm.draftNotes).toEqual({ "1": 4, "3": 5 });
    expect(vm.round).toMatchObject({
      id: "2",
      number: 2,
      startupName: "AguaClara",
      description: "Filtros comunitarios.",
      logoUrl: "https://example.test/agua.png",
    });
  });

  it("cambia a vote_registered cuando el jurado ya envió en la ronda en votación", () => {
    const rounds = [round({ numero: 3, estado: "VOTING", startup_nombre: "EduRuta" })];
    const vm = buildJuryView({
      ...base,
      rounds,
      votes: [
        vote("1", "Jurado 1", { enviado: true, puntaje: "4.500" }),
        vote("2", "Jurado 2", { enviado: true, puntaje: "3.750" }),
      ],
      ownVerdicts: [{ id_ronda: "3", se_abstiene: false, puntaje: "3.750" }],
      draftNotes: [],
      ownRoundNotes: [
        { id_criterio: "1", valor: 4 },
        { id_criterio: "2", valor: 4 },
        { id_criterio: "3", valor: 4 },
        { id_criterio: "4", valor: 3 },
      ],
      revealedNotes: [],
      description: "Rutas de aprendizaje.",
    });

    expect(vm.screen).toBe("vote_registered");
    expect(vm.ownVerdict).toEqual({
      abstained: false,
      score: 3.75,
      notes: { "1": 4, "2": 4, "3": 4, "4": 3 },
    });
    expect(vm.votes).toEqual({ emitted: 2, total: 4 });
  });

  it("no expone las notas ni los puntajes de otros jurados antes de liquidar", () => {
    const vm = buildJuryView({
      ...base,
      rounds: [round({ numero: 3, estado: "VOTING" })],
      votes: [
        vote("1", "Jurado 1", { enviado: true, puntaje: "4.750" }),
        vote("2", "Jurado 2", { enviado: false }),
      ],
      ownVerdicts: [],
      draftNotes: [],
      ownRoundNotes: [],
      revealedNotes: [{ id_jurado: "1", id_criterio: "1", valor: 5 }],
      description: null,
    });

    expect(vm.reveal).toBeNull();
    expect(vm.votes).toEqual({ emitted: 1, total: 4 });
    expect(JSON.stringify(vm)).not.toContain("4.75");
  });

  it("publica el puntaje de la startup, el multiplicador y las notas de los 4 jurados al liquidar", () => {
    const rounds = event(["SETTLED", "SETTLED", "SETTLED", "SETTLED", "SETTLED"]);
    rounds[4] = { ...rounds[4], multiplicador: "1.400", puntaje_jurado: "4.0000" };
    const vm = buildJuryView({
      ...base,
      rounds,
      votes: [
        vote("1", "Jurado 1", { enviado: true, puntaje: "4.250" }),
        vote("2", "Jurado 2", { enviado: true, puntaje: "3.750" }),
        vote("3", "Jurado 3", { enviado: true, se_abstiene: true, puntaje: null }),
        vote("4", "Jurado 4", { enviado: false }),
      ],
      ownVerdicts: [{ id_ronda: "5", se_abstiene: false, puntaje: "3.750" }],
      draftNotes: [],
      ownRoundNotes: [],
      revealedNotes: [
        { id_jurado: "1", id_criterio: "1", valor: 5 },
        { id_jurado: "2", id_criterio: "1", valor: 4 },
      ],
      description: null,
    });

    expect(vm.screen).toBe("result");
    expect(vm.reveal).toEqual({
      startupScore: 4,
      multiplier: 1.4,
      isLastRound: true,
      jurors: [
        { label: "Jurado 1", isOwn: false, submitted: true, abstained: false, score: 4.25, notes: { "1": 5 } },
        { label: "Jurado 2", isOwn: true, submitted: true, abstained: false, score: 3.75, notes: { "1": 4 } },
        { label: "Jurado 3", isOwn: false, submitted: true, abstained: true, score: null, notes: {} },
        { label: "Jurado 4", isOwn: false, submitted: false, abstained: false, score: null, notes: {} },
      ],
    });
  });

  it("construye el recorrido con el resumen propio de las rondas terminadas", () => {
    const vm = buildJuryView({
      ...base,
      rounds: [
        round({ numero: 1, estado: "SETTLED", startup_nombre: "AgroSense" }),
        round({ numero: 2, estado: "CANCELLED", startup_nombre: "AguaClara" }),
        round({ numero: 3, estado: "VOTING", startup_nombre: "EduRuta" }),
        round({ numero: 4, estado: "SCHEDULED", startup_nombre: "SolRed" }),
      ],
      votes: [vote("2", "Jurado 2", { enviado: false })],
      ownVerdicts: [
        { id_ronda: "1", se_abstiene: false, puntaje: "4.250" },
        { id_ronda: "2", se_abstiene: true, puntaje: null },
      ],
      draftNotes: [],
      ownRoundNotes: [],
      revealedNotes: [],
      description: null,
    });

    expect(vm.rail).toEqual([
      { number: 1, startupName: "AgroSense", status: "settled", ownVerdict: { abstained: false, score: 4.25 } },
      { number: 2, startupName: "AguaClara", status: "settled", ownVerdict: { abstained: true, score: null } },
      { number: 3, startupName: "EduRuta", status: "current", ownVerdict: null },
      { number: 4, startupName: "SolRed", status: "pending", ownVerdict: null },
    ]);
  });
});
