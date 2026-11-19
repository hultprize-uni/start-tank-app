// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOperatorState, type OperatorStateApi } from "./mock";

/*
 * Pruebas del estado de muestra de la consola. Usan relojes simulados para avanzar el temporizador
 * de la última llamada sin esperar en tiempo real.
 */

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-26T15:00:00.000Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Renderiza el estado de muestra y devuelve un acceso estable a su última versión. */
function setup() {
  const { result } = renderHook(() => useOperatorState());
  const current = (): OperatorStateApi => result.current;
  return { current, result };
}

describe("useOperatorState (muestra)", () => {
  it("inicia con la ronda 2 en votación y tres votos emitidos", () => {
    const { current } = setup();

    expect(current().viewModel.round).toMatchObject({ number: 2, status: "VOTING" });
    expect(current().viewModel.jurors.filter((juror) => juror.emitted)).toHaveLength(3);
    expect(current().viewModel.actions.find((action) => action.id === "reveal")).toMatchObject({
      enabled: false,
      blockedReason: "Bloqueado: falta 1 voto",
    });
  });

  it("desbloquea el veredicto al emitir el último voto y calcula el multiplicador", () => {
    const { current } = setup();

    act(() => current().simulateJurorVote("jurado-4"));
    act(() => current().runAction("reveal"));

    expect(current().viewModel.round).toMatchObject({ status: "SETTLED", multiplier: 1.4 });
    expect(current().viewModel.standings.map((standing) => standing.roundNumber)).toEqual([2, 1]);
    expect(current().viewModel.rounds[1]).toMatchObject({ status: "SETTLED", multiplier: 1.4 });
  });

  it("cierra la última llamada automáticamente al llegar el temporizador a cero", () => {
    const { current } = setup();

    act(() => current().simulateJurorVote("jurado-4"));
    act(() => current().runAction("reveal"));
    act(() => current().runAction("next"));
    act(() => current().runAction("open"));
    act(() => current().runAction("last_call"));

    expect(current().viewModel.round.status).toBe("LAST_CALL");
    expect(current().viewModel.market.lastCallRemaining).toBe(60);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(current().viewModel.market.lastCallRemaining).toBe(30);
    expect(current().viewModel.round.status).toBe("LAST_CALL");

    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(current().viewModel.round.status).toBe("VOTING");
    expect(current().viewModel.market.lastCallRemaining).toBeNull();
    expect(current().viewModel.log[1].label).toBe("Cierre automático de la última llamada");
  });

  it("deshace la última acción de mercado antes de la votación", () => {
    const { current } = setup();

    act(() => current().simulateJurorVote("jurado-4"));
    act(() => current().runAction("reveal"));
    act(() => current().runAction("next"));
    act(() => current().runAction("open"));
    act(() => current().runAction("last_call"));
    expect(current().viewModel.canUndo).toBe(true);

    act(() => current().undo());
    expect(current().viewModel.round.status).toBe("OPEN");
    expect(current().viewModel.market.lastCallRemaining).toBeNull();
  });

  it("liquida con el número de jurados que respaldan en modo manual", () => {
    const { current } = setup();

    act(() => current().setManualMode(true));
    expect(current().viewModel.manualMode).toEqual({ enabled: true, backs: 2 });
    expect(current().viewModel.actions.find((action) => action.id === "reveal")).toMatchObject({
      enabled: true,
      blockedReason: null,
    });

    act(() => current().setManualBacks(4));
    act(() => current().runAction("reveal"));

    expect(current().viewModel.round).toMatchObject({ status: "SETTLED", multiplier: 1.8 });
    expect(current().viewModel.log[0].label).toBe("Liquidación manual");
  });

  it("anula la ronda en votación con el modo elegido y la marca como anulada", () => {
    const { current } = setup();

    expect(current().viewModel.canCancel).toBe(true);
    act(() => current().cancelRound("settle_1x"));

    expect(current().viewModel.round).toMatchObject({
      status: "CANCELLED",
      multiplier: null,
      cancelMode: "settle_1x",
    });
    expect(current().viewModel.rounds[1].status).toBe("CANCELLED");
    expect(current().viewModel.standings.map((standing) => standing.roundNumber)).toEqual([1]);
  });
});
