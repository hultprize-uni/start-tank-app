import { describe, expect, it } from "vitest";
import { nextState, ROUND_TRANSITIONS } from "./roundMachine";
import type { OperatorAction, RoundState } from "./types";

const ACCIONES: readonly OperatorAction[] = [
  "ABRIR",
  "ULTIMA_LLAMADA",
  "CERRAR",
  "HABILITAR_VOTO",
  "REVELAR",
  "SIGUIENTE",
  "ANULAR_DEVOLVER",
  "ANULAR_LIQUIDAR_1X",
  "DESHACER",
  "MODO_MANUAL",
];

describe("nextState", () => {
  it("recorre el ciclo completo de una ronda liquidada", () => {
    const pasos: [RoundState, OperatorAction, RoundState][] = [
      ["PROGRAMADA", "ABRIR", "ABIERTA"],
      ["ABIERTA", "ULTIMA_LLAMADA", "ULTIMA_LLAMADA"],
      ["ULTIMA_LLAMADA", "CERRAR", "CERRADA"],
      ["CERRADA", "HABILITAR_VOTO", "EN_VOTACION"],
      ["EN_VOTACION", "REVELAR", "LIQUIDADA"],
    ];

    for (const [desde, accion, esperado] of pasos) {
      expect(nextState(desde, accion)).toEqual({ ok: true, state: esperado });
    }
  });

  it("permite anular una ronda cerrada con cualquiera de las dos modalidades", () => {
    expect(nextState("CERRADA", "ANULAR_DEVOLVER")).toEqual({ ok: true, state: "ANULADA" });
    expect(nextState("CERRADA", "ANULAR_LIQUIDAR_1X")).toEqual({ ok: true, state: "ANULADA" });
  });

  it("rechaza revelar antes de que la ronda entre en votación", () => {
    expect(nextState("ABIERTA", "REVELAR")).toEqual({
      ok: false,
      reason: "TRANSICION_INVALIDA",
    });
  });

  it("rechaza anular una ronda que ya está en votación", () => {
    expect(nextState("EN_VOTACION", "ANULAR_DEVOLVER")).toEqual({
      ok: false,
      reason: "TRANSICION_INVALIDA",
    });
  });

  it("rechaza cualquier acción sobre estados terminales", () => {
    for (const estado of ["LIQUIDADA", "ANULADA"] as const) {
      for (const accion of ACCIONES) {
        expect(nextState(estado, accion)).toEqual({
          ok: false,
          reason: "TRANSICION_INVALIDA",
        });
      }
    }
  });

  it("rechaza las acciones que no modifican el estado de la ronda", () => {
    for (const accion of ["SIGUIENTE", "DESHACER", "MODO_MANUAL"] as const) {
      expect(nextState("CERRADA", accion)).toEqual({
        ok: false,
        reason: "TRANSICION_INVALIDA",
      });
    }
  });

  it("solo acepta las transiciones declaradas en la tabla", () => {
    const estados = Object.keys(ROUND_TRANSITIONS) as RoundState[];

    for (const estado of estados) {
      for (const accion of ACCIONES) {
        const declarada = ROUND_TRANSITIONS[estado][accion];
        const resultado = nextState(estado, accion);

        if (declarada === undefined) {
          expect(resultado.ok).toBe(false);
        } else {
          expect(resultado).toEqual({ ok: true, state: declarada });
        }
      }
    }
  });
});
