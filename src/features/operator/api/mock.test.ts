import { beforeEach, describe, expect, it } from "vitest";

import { MOCK_OPERATOR_CODE, MOCK_REHEARSAL_CODE, MOCK_SUPPORT_CODE, mockServer } from "./mock";

/*
 * El servidor de muestra debe aplicar las mismas reglas que la API, para que la consola se
 * desarrolle contra un contrato fiel con NEXT_PUBLIC_USE_MOCKS=true.
 */

const T0 = Date.parse("2026-11-26T19:30:00.000Z");

function stateAt(now: number) {
  const response = mockServer.state(now);
  if (!response.ok) throw new Error(`state ${response.code}`);
  return response.data;
}

beforeEach(() => {
  mockServer.logout();
});

describe("mockServer", () => {
  it("exige sesión y rechaza códigos inválidos", () => {
    expect(mockServer.state(T0)).toMatchObject({ ok: false, status: 401 });
    expect(mockServer.login("NOPE")).toMatchObject({ ok: false, code: "INVALID_CODE" });
  });

  it("el soporte solo lee (RF-05)", () => {
    mockServer.login(MOCK_SUPPORT_CODE);
    expect(stateAt(Date.now()).operator.role).toBe("SUPPORT");
    expect(mockServer.action("LAST_CALL", null)).toMatchObject({ ok: false, status: 403 });
    expect(mockServer.balance("1", 500, "x")).toMatchObject({ ok: false, status: 403 });
  });

  it("recorre la ronda: última llamada que se cierra sola, votación y rescate", () => {
    mockServer.login(MOCK_OPERATOR_CODE);
    const t = Date.now();
    expect(stateAt(t).round).toMatchObject({ number: 2, status: "OPEN" });

    expect(mockServer.action("LAST_CALL", null, t).ok).toBe(true);
    // Cierre automático al vencer la última llamada (RF-08).
    expect(stateAt(t + 61_000).round.status).toBe("CLOSED");

    expect(mockServer.action("ENABLE_VOTING", null, t + 62_000).ok).toBe(true);
    // A los 30 s enviaron los jurados 1, 2 y 4; el 3 está desconectado.
    const voting = stateAt(t + 92_000);
    expect(voting.jurors.map((juror) => juror.status)).toEqual(["sent", "sent", "drafting", "sent"]);
    expect(voting.mainAction?.enabled).toBe(false);
    expect(voting.canRescue).toBe(true);

    expect(mockServer.action("REVEAL", null, t + 92_000)).toMatchObject({ code: "PENDING_VOTES" });
    const rescued = mockServer.action("REVEAL", "Jurado 3 sin conexión", t + 92_000);
    expect(rescued.ok).toBe(true);
    const settled = stateAt(t + 93_000);
    expect(settled.rounds[1].status).toBe("SETTLED");
    expect(settled.log[0]).toMatchObject({
      label: "Reveló con los jurados presentes",
      reason: "Jurado 3 sin conexión",
    });
  });

  it("pausa y reanuda conservando los segundos (RF-07)", () => {
    mockServer.login(MOCK_OPERATOR_CODE);
    const t = Date.now();
    mockServer.action("LAST_CALL", null, t);
    mockServer.action("PAUSE", null, t + 30_000);
    const paused = stateAt(t + 50_000);
    expect(paused.clock).toMatchObject({ paused: true, pausedSeconds: 30 });
    mockServer.action("RESUME", null, t + 50_000);
    expect(stateAt(t + 50_000).clock.phaseEndsAt).toBe(new Date(t + 80_000).toISOString());
  });

  it("bloquea la configuración con una ronda abierta (RF-28)", () => {
    mockServer.login(MOCK_OPERATOR_CODE);
    expect(mockServer.updateConfig({ kind: "setting", key: "tope_ronda", value: 0.25 })).toMatchObject({
      ok: false,
      code: "ROUND_OPEN",
    });
  });

  it("antes del evento: inicia con el checklist en verde y luego bloquea el ensayo (RF-29)", () => {
    mockServer.login(MOCK_REHEARSAL_CODE);
    const preflight = mockServer.preflight();
    expect(preflight.ok && preflight.data.ready).toBe(true);
    expect(mockServer.updateConfig({ kind: "setting", key: "tope_ronda", value: 0.25 }).ok).toBe(true);
    expect(mockServer.startEvent().ok).toBe(true);
    expect(mockServer.rehearsal()).toMatchObject({ ok: false, code: "EVENT_STARTED" });
  });

  it("ajusta saldos con motivo y no deja saldos negativos (RF-11)", () => {
    mockServer.login(MOCK_OPERATOR_CODE);
    expect(mockServer.balance("1", 500, "")).toMatchObject({ code: "REASON_REQUIRED" });
    expect(mockServer.balance("1", -1_000_000, "x")).toMatchObject({ code: "NEGATIVE_BALANCE" });
    const before = stateAt(Date.now()).balances.find((row) => row.attendeeId === "1");
    const result = mockServer.balance("1", 500, "Error del sistema");
    expect(result.ok && result.data.balance).toBe((before?.balance ?? 0) + 500);
    expect(stateAt(Date.now()).log[0]).toMatchObject({ label: "Ajustó un saldo" });
  });
});
