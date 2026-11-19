import { describe, expect, it } from "vitest";
import type { RoundRow, RoundVoteRow } from "@/server/db/rounds";
import { buildOperatorView, operatorReferenceRound, type OperatorData } from "./mappers";

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

describe("buildOperatorView", () => {
  function operator(
    rounds: RoundRow[],
    extra: Partial<OperatorData> = {},
  ): OperatorData {
    return {
      rounds,
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
    // La anulación solo se ofrece con la ronda cerrada o en votación.
    expect(vm?.canCancel).toBe(false);
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

    expect(revelar).toMatchObject({ enabled: false, blockedReason: "Bloqueado: falta 1 voto" });
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

describe("buildOperatorView: puntajes, cuenta regresiva y registro", () => {
  const NOW_DATE = new Date("2026-11-08T15:04:05.000Z");

  function operator(rounds: RoundRow[], extra: Partial<OperatorData> = {}): OperatorData {
    return {
      rounds,
      votes: [],
      cancelAction: null,
      activeUsers: 74,
      balances: [],
      positions: [],
      actions: [],
      now: NOW_DATE,
      ...extra,
    };
  }

  it("ordena los puntajes de las rondas liquidadas de mayor a menor y excluye las anuladas", () => {
    const vm = buildOperatorView(
      operator([
        round({ numero: 1, estado: "SETTLED", multiplicador: "1.40", puntaje: "0.55", fraccion_respaldo: "0.50" }),
        round({ numero: 2, estado: "SETTLED", multiplicador: "1.80", puntaje: "0.82", fraccion_respaldo: "0.75" }),
        round({ numero: 3, estado: "CANCELLED", multiplicador: "1.00", puntaje: "0.90", fraccion_respaldo: null }),
      ]),
    );

    expect(vm?.standings.map((s) => s.roundNumber)).toEqual([2, 1]);
    expect(vm?.standings[0]).toMatchObject({ startupName: "Startup 2", score: 0.82, fraction: 0.75 });
  });

  it("calcula los segundos restantes de la última llamada a partir del tiempo transcurrido", () => {
    const enCurso = buildOperatorView(
      operator([round({ numero: 1, estado: "LAST_CALL", segundos_ultima_llamada: 45.7 })]),
    );
    const agotada = buildOperatorView(
      operator([round({ numero: 1, estado: "LAST_CALL", segundos_ultima_llamada: 75 })]),
    );
    const abierta = buildOperatorView(
      operator([round({ numero: 1, estado: "OPEN", segundos_ultima_llamada: null })]),
    );

    expect(enCurso?.market.lastCallRemaining).toBe(15);
    expect(agotada?.market.lastCallRemaining).toBe(0);
    expect(abierta?.market.lastCallRemaining).toBeNull();
  });

  it("lista todas las rondas con su multiplicador solo cuando están liquidadas", () => {
    const vm = buildOperatorView(
      operator([
        round({ numero: 1, estado: "SETTLED", multiplicador: "1.40" }),
        round({ numero: 2, estado: "VOTING" }),
        round({ numero: 3, estado: "SCHEDULED" }),
      ]),
    );

    expect(vm?.rounds).toEqual([
      { number: 1, startupName: "Startup 1", status: "SETTLED", multiplier: 1.4 },
      { number: 2, startupName: "Startup 2", status: "VOTING", multiplier: null },
      { number: 3, startupName: "Startup 3", status: "SCHEDULED", multiplier: null },
    ]);
  });

  it("registra cada acción con hora HH:MM:SS, número de ronda y etiqueta visible", () => {
    const vm = buildOperatorView(
      operator([round({ numero: 2, estado: "VOTING" })], {
        actions: [
          { id_accion: "9", accion: "REVEAL", ejecutada_en: NOW_DATE, operador: "op.1", numero: 2, startup_nombre: "Startup 2" },
        ],
      }),
    );

    expect(vm?.log[0]).toMatchObject({ time: "10:04:05", roundNumber: 2, label: "Revelar veredicto" });
  });

  it("permite anular solo con la ronda en votación o cerrada y deja el modo manual apagado", () => {
    const enVotacion = buildOperatorView(operator([round({ numero: 1, estado: "VOTING" })]));
    const abierta = buildOperatorView(operator([round({ numero: 1, estado: "OPEN" })]));

    expect(enVotacion?.canCancel).toBe(true);
    expect(abierta?.canCancel).toBe(false);
    expect(enVotacion?.manualMode).toEqual({ enabled: false, backs: 0 });
    expect(enVotacion?.canManualSettle).toBe(false);
  });
});
