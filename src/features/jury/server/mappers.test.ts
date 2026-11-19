import { describe, expect, it } from "vitest";
import type { RoundRow, RoundVoteRow } from "@/server/db/rounds";
import { buildJuryView, type JuryData } from "./mappers";

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
