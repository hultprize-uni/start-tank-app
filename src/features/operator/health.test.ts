import { describe, expect, it } from "vitest";

import { buildHealth, connectionAlert, type HealthInput } from "./health";

function input(extra: Partial<HealthInput> = {}): HealthInput {
  return {
    now: new Date("2026-11-26T19:30:00.000Z"),
    dbLatencyMs: 120,
    attendeesOnline: 70,
    attendeesTotal: 78,
    jurors: ["1", "2", "3", "4"].map((id) => ({
      id,
      name: `Jurado ${id}`,
      secondsSinceSeen: 3,
      sent: false,
    })),
    round: { number: 2, status: "OPEN" },
    ...extra,
  };
}

describe("buildHealth (RF-26)", () => {
  it("todo en verde sin alertas", () => {
    const health = buildHealth(input());
    expect(health.signals.map((signal) => signal.level)).toEqual(["ok", "ok", "ok"]);
    expect(health.alerts).toEqual([]);
  });

  it("alerta Jurado desconectado tras 45 s en la votación, con la opción de rescate", () => {
    const jurors = input().jurors.map((juror) =>
      juror.id === "3" ? { ...juror, secondsSinceSeen: 45 } : juror,
    );
    const health = buildHealth(input({ jurors, round: { number: 2, status: "VOTING" } }));
    expect(health.alerts).toHaveLength(1);
    expect(health.alerts[0]).toMatchObject({
      level: "critical",
      title: "Jurado 3 desconectado hace 45 s",
      action: "rescue",
    });
    expect(health.signals.find((signal) => signal.id === "jurors")).toMatchObject({
      value: "3 de 4",
      level: "critical",
    });
  });

  it("no alerta por un jurado desconectado que ya envió", () => {
    const jurors = input().jurors.map((juror) => ({ ...juror, sent: true, secondsSinceSeen: 120 }));
    const health = buildHealth(input({ jurors, round: { number: 2, status: "VOTING" } }));
    expect(health.alerts).toEqual([]);
  });

  it("base de datos lenta: ámbar desde 0.5 s y rojo con modo manual desde 1 s", () => {
    expect(buildHealth(input({ dbLatencyMs: 600 })).alerts[0]).toMatchObject({ level: "warning" });
    expect(buildHealth(input({ dbLatencyMs: 1400 })).alerts[0]).toMatchObject({
      level: "critical",
      action: "manual_mode",
    });
  });

  it("avisa de pocos teléfonos conectados con el mercado abierto", () => {
    expect(buildHealth(input({ attendeesOnline: 20 })).alerts[0]).toMatchObject({
      level: "warning",
      action: "attendees",
    });
    expect(buildHealth(input({ attendeesOnline: 0 })).alerts[0]).toMatchObject({ level: "critical" });
    expect(
      buildHealth(input({ attendeesOnline: 0, round: { number: 2, status: "SETTLED" } })).alerts,
    ).toEqual([]);
  });
});

describe("connectionAlert (RF-27)", () => {
  it("no alerta mientras llegan datos", () => {
    expect(connectionAlert(5)).toBeNull();
  });

  it("alerta a los 15 s y sugiere el modo manual a los 90 s", () => {
    expect(connectionAlert(20)).toMatchObject({ level: "critical", action: "retry" });
    expect(connectionAlert(95)).toMatchObject({ action: "manual_mode" });
  });
});
