import { describe, expect, it } from "vitest";

import {
  actionLabel,
  formatAgo,
  formatClock,
  formatMultiplier,
  formatScheduleDelta,
  formatSignedCoins,
} from "./labels";

describe("formatMultiplier", () => {
  it("quita los ceros finales y conserva hasta dos decimales", () => {
    expect(formatMultiplier(1.4)).toBe("1.4x");
    expect(formatMultiplier(1.27)).toBe("1.27x");
    expect(formatMultiplier(1)).toBe("1x");
  });
});

describe("formatos de la consola", () => {
  it("formatea el cronómetro con dos dígitos", () => {
    expect(formatClock(161)).toBe("02:41");
    expect(formatClock(-4)).toBe("00:00");
  });

  it("formatea montos con signo", () => {
    expect(formatSignedCoins(500)).toBe("+500");
    expect(formatSignedCoins(-1200)).toBe("-1,200");
  });

  it("formatea el adelanto o atraso del evento", () => {
    expect(formatScheduleDelta(180)).toBe("Evento 3 min atrasado");
    expect(formatScheduleDelta(-120)).toBe("Evento 2 min adelantado");
    expect(formatScheduleDelta(20)).toBe("Evento a tiempo");
  });

  it("formatea la última conexión", () => {
    expect(formatAgo(3)).toBe("hace 3 s");
    expect(formatAgo(125)).toBe("hace 2 min");
    expect(formatAgo(null)).toBe("Sin conexión registrada");
  });

  it("traduce las acciones del log, incluidas las que la base guarda sin traducir", () => {
    expect(actionLabel("PAUSE")).toBe("Pausó la fase");
    expect(actionLabel("AJUSTE_SALDO")).toBe("Ajustó un saldo");
    expect(actionLabel("DESCONOCIDA")).toBe("DESCONOCIDA");
  });
});
