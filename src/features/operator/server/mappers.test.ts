import { describe, expect, it } from "vitest";

import { EVENT_CONFIG } from "@/shared/domain/config";
import type { RoundRow } from "@/server/db/rounds";

import {
  buildOperatorViewFromRows,
  cancelModeOf,
  toAttendeeView,
  toOperatorRole,
  type OperatorData,
} from "./mappers";

const NOW = new Date("2026-11-26T19:30:00.000Z");

function round(partial: Partial<RoundRow> & Pick<RoundRow, "numero" | "estado">): RoundRow {
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

function data(extra: Partial<OperatorData> = {}): OperatorData {
  return {
    operator: { nombre: "Diego", rol: "CONDUCTOR" },
    config: { ...EVENT_CONFIG },
    flags: { eventStarted: true, manualMode: false },
    rounds: [round({ numero: 1, estado: "OPEN" })],
    firstOpenAt: null,
    jurors: [],
    cancelAction: null,
    attendeesOnline: 0,
    attendeesTotal: 0,
    actions: [],
    balances: [],
    positions: [],
    now: NOW,
    ...extra,
  };
}

describe("toOperatorRole (RF-03)", () => {
  it("solo CONDUCTOR ejecuta; cualquier otro rol es soporte", () => {
    expect(toOperatorRole("CONDUCTOR")).toBe("CONDUCTOR");
    expect(toOperatorRole("SOPORTE")).toBe("SUPPORT");
    expect(toOperatorRole("OTRO")).toBe("SUPPORT");
  });
});

describe("cancelModeOf", () => {
  it("traduce la anulación registrada", () => {
    expect(cancelModeOf("CANCEL_REFUND")).toBe("refund");
    expect(cancelModeOf("CANCEL_SETTLE_1X")).toBe("settle_1x");
    expect(cancelModeOf(null)).toBeNull();
  });
});

describe("buildOperatorViewFromRows", () => {
  it("convierte los valores numéricos, el rol, el reloj y las duraciones", () => {
    const view = buildOperatorViewFromRows(
      data({
        operator: { nombre: "Ana", rol: "SOPORTE" },
        rounds: [
          round({
            numero: 1,
            estado: "OPEN",
            monto_acumulado: "56500.00",
            inversores_unicos: 47,
            precio_vivo: "128.40",
            fase_termina_en: "2026-11-26T19:32:41.000Z",
          }),
        ],
        attendeesOnline: 78,
        attendeesTotal: 81,
      }),
    );
    expect(view?.operator).toEqual({ name: "Ana", role: "SUPPORT" });
    expect(view?.market).toEqual({
      accumulated: 56500,
      uniqueInvestors: 47,
      connectedAttendees: 78,
      totalAttendees: 81,
      price: 128.4,
    });
    expect(view?.clock.phaseEndsAt).toBe("2026-11-26T19:32:41.000Z");
    expect(view?.durations.qa).toBe(EVENT_CONFIG.qaSeconds);
    expect(view?.serverTime).toBe(NOW.toISOString());
  });

  it("no expone el puntaje del jurado antes de liquidar (RNF-11)", () => {
    const view = buildOperatorViewFromRows(
      data({
        rounds: [round({ numero: 1, estado: "VOTING" })],
        jurors: [
          {
            id: "1",
            name: "Jurado 1",
            sent: true,
            abstains: false,
            drafting: false,
            score: "4.250",
            seconds_since_seen: 3,
          },
        ],
      }),
    );
    expect(view?.jurors[0]).toMatchObject({ status: "sent", score: null, online: true });
  });

  it("incluye el motivo de cada acción del log (RF-09)", () => {
    const view = buildOperatorViewFromRows(
      data({
        actions: [
          {
            id_accion: "4",
            accion: "CANCEL_REFUND",
            ejecutada_en: "2026-11-26T20:00:00.000Z",
            operador: "Diego",
            numero: 2,
            motivo: "Falla del proyector",
          },
        ],
      }),
    );
    expect(view?.log[0]).toMatchObject({
      roundNumber: 2,
      operator: "Diego",
      reason: "Falla del proyector",
      label: "Anuló la ronda y devolvió lo invertido",
    });
  });
});

describe("toAttendeeView", () => {
  it("arma la ficha con la posición, la conexión y la última inversión", () => {
    const view = toAttendeeView(
      {
        id: "7",
        name: null,
        email: "diego@uni.pe",
        balance: "7000.00",
        position: 7,
        seconds_since_seen: 3.6,
        last_round: 2,
        last_startup: "AguaClara",
        last_amount: "3000.00",
      },
      30,
    );
    expect(view).toEqual({
      id: "7",
      name: "Asistente 7",
      email: "diego@uni.pe",
      balance: 7000,
      position: 7,
      online: true,
      lastSeenSeconds: 3,
      lastInvestment: { roundNumber: 2, startupName: "AguaClara", amount: 3000 },
    });
  });
});
