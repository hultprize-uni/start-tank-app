import { describe, expect, it } from "vitest";
import { EVENT_CONFIG } from "@/shared/domain/config";
import type { RoundRow, RoundVoteRow } from "@/server/db/rounds";
import { buildScreen, resolvePhase, shortName, type ScreenData } from "./mappers";

const NOW = new Date("2026-11-26T20:00:00.000Z");
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000).toISOString();

function round(numero: number, estado: RoundRow["estado"], extra: Partial<RoundRow> = {}): RoundRow {
  return {
    id_ronda: String(numero),
    numero,
    estado,
    multiplicador: null,
    segundos_ultima_llamada: null,
    fase_termina_en: null,
    segundos_restantes_pausa: null,
    liquidada_en: null,
    startup_nombre: ["AgroSense", "AguaClara", "EduRuta", "SolRed", "SaludCerca"][numero - 1],
    ods: "ODS 6",
    monto_acumulado: "0",
    inversores_unicos: 0,
    precio_vivo: "100",
    puntaje_jurado: null,
    fraccion_respaldo: null,
    puntaje: null,
    monto_invertido: "0",
    retorno_ronda: "0",
    ...extra,
  };
}

function vote(sent: boolean, score: string | null, abstained = false): RoundVoteRow {
  return { id_jurado: "1", nombre: "J", enviado: sent, se_abstiene: abstained, puntaje: score, decision: null };
}

function data(rounds: RoundRow[], extra: Partial<ScreenData> = {}): ScreenData {
  return {
    now: NOW,
    config: { ...EVENT_CONFIG },
    manualMode: false,
    rounds,
    startups: new Map(),
    votes: [],
    juryTimes: [],
    investments: [],
    actions: [],
    ranking: [],
    previousPositions: new Map(),
    attendees: 80,
    bestEye: null,
    ...extra,
  };
}

const scheduled = (from: number) =>
  [1, 2, 3, 4, 5].filter((n) => n >= from).map((n) => round(n, "SCHEDULED"));

describe("shortName", () => {
  it("keeps the first name and the initial of the surname", () => {
    expect(shortName("Mariana Torres Díaz")).toBe("Mariana T.");
    expect(shortName("Lucía")).toBe("Lucía");
    expect(shortName("Asistente 12")).toBe("Asistente 12");
  });
});

describe("resolvePhase", () => {
  it("waits for the first startup before any round", () => {
    expect(resolvePhase(scheduled(1), NOW)).toMatchObject({ phase: "WAITING", reference: { numero: 1 } });
  });

  it("shows the verdict during the result window and between rounds after it", () => {
    const settledNow = round(1, "SETTLED", { fase_termina_en: at(60) });
    expect(resolvePhase([settledNow, ...scheduled(2)], NOW).phase).toBe("REVEAL");
    const settledBefore = round(1, "SETTLED", { fase_termina_en: at(-1) });
    expect(resolvePhase([settledBefore, ...scheduled(2)], NOW).phase).toBe("BETWEEN");
  });

  it("closes the event once the final scores are loaded", () => {
    const rounds = [1, 2, 3, 4, 5].map((n) => round(n, "SETTLED", { puntaje: "0.5" }));
    expect(resolvePhase(rounds, NOW).phase).toBe("CLOSING");
  });
});

describe("buildScreen", () => {
  it("labels the pitch and the Q&A, each with its own server clock", () => {
    const open = round(2, "PITCH", { fase_termina_en: at(100) });
    const vm = buildScreen(data([round(1, "SETTLED", { multiplicador: "1.400" }), open, ...scheduled(3)]));

    expect(vm.phase).toBe("MARKET");
    expect(vm.clockLabel).toBe("Pitch");
    expect(vm.clock?.phaseEndsAt).toBe(at(100));

    const qa = buildScreen(data([round(1, "SETTLED"), round(2, "OPEN", { fase_termina_en: at(300) }), ...scheduled(3)]));
    expect(qa.clockLabel).toBe("Toma y dame");
    expect(qa.clock?.phaseEndsAt).toBe(at(300));
  });

  it("builds the stepped curve and announces big bets and milestones", () => {
    const vm = buildScreen(
      data([round(1, "OPEN", { monto_acumulado: "10500" }), ...scheduled(2)], {
        investments: [
          { monto: "8000", creada_en: at(-30) },
          { monto: "2500", creada_en: at(-10) },
        ],
      }),
    );
    expect(vm.market?.points.map((p) => p.total)).toEqual([8000, 10500]);
    expect(vm.feed.map((item) => item.text)).toEqual([
      "Apuesta grande en AgroSense: 2,500 IC",
      "AgroSense supera 10,000 IC",
      "Apuesta grande en AgroSense: 8,000 IC",
    ]);
  });

  it("lights the seats without showing scores until the reveal", () => {
    const votes = [vote(true, "4.000"), vote(true, "3.500"), vote(false, null), vote(true, null, true)];
    const voting = buildScreen(data([round(1, "VOTING"), ...scheduled(2)], { votes }));
    expect(voting.jury.map((s) => [s.label, s.sent, s.score])).toEqual([
      ["Jurado 1", true, null],
      ["Jurado 2", true, null],
      ["Jurado 3", false, null],
      ["Jurado 4", true, null],
    ]);

    const settled = round(1, "SETTLED", {
      multiplicador: "1.400",
      puntaje_jurado: "4.0000",
      liquidada_en: at(-1),
      fase_termina_en: at(89),
      monto_invertido: "56500",
      retorno_ronda: "79100",
    });
    const reveal = buildScreen(data([settled, ...scheduled(2)], { votes }));
    expect(reveal.phase).toBe("REVEAL");
    expect(reveal.jury.map((s) => s.score)).toEqual([4, 3.5, null, null]);
    expect(reveal.verdict).toMatchObject({ multiplier: 1.4, juryScore: 4, scorePct: 75, invested: 56500, returned: 79100 });
    expect(reveal.feed[0].text).toBe("Multiplicador de AgroSense: 1.4x");
  });

  it("marks the ticker by state and shows the next startup between rounds", () => {
    const vm = buildScreen(
      data([round(1, "SETTLED", { multiplicador: "0.600", fase_termina_en: at(-5) }), round(2, "CANCELLED"), ...scheduled(3)]),
    );
    expect(vm.phase).toBe("BETWEEN");
    expect(vm.ticker.map((t) => [t.name, t.status, t.multiplier])).toEqual([
      ["AgroSense", "done", 0.6],
      ["AguaClara", "cancelled", null],
      ["EduRuta", "next", null],
      ["SolRed", "pending", null],
      ["SaludCerca", "pending", null],
    ]);
    expect(vm.next?.name).toBe("EduRuta");
  });

  it("names the winner, the top 3 and the best eye at the close", () => {
    const rounds = [1, 2, 3, 4, 5].map((n) =>
      round(n, "SETTLED", { puntaje: n === 4 ? "0.8100" : "0.5000", puntaje_jurado: "4.4000", inversores_unicos: 62, multiplicador: "1.600" }),
    );
    const vm = buildScreen(
      data(rounds, {
        ranking: [
          { id_usuario: "7", nombre: "Mariana Torres", posicion: 1, saldo: "16940", aciertos: 3 },
          { id_usuario: "8", nombre: "Joaquín Ruiz", posicion: 2, saldo: "15210", aciertos: 2 },
          { id_usuario: "9", nombre: "Valeria Quispe", posicion: 3, saldo: "14380", aciertos: 1 },
        ],
        bestEye: { nombre: "Lucía Huamán", aciertos: 5 },
      }),
    );
    expect(vm.closing?.winner).toMatchObject({ name: "SolRed", finalScore: 0.81, investorShare: 0.775 });
    expect(vm.closing?.top3.map((row) => row.name)).toEqual(["Mariana T.", "Joaquín R.", "Valeria Q."]);
    expect(vm.closing?.bestEye).toEqual({ name: "Lucía H.", hits: 5, rounds: 5 });
  });
});
