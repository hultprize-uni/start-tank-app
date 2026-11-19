import { describe, expect, it } from "vitest";
import { calcVerdict, multiplierFor } from "./verdict";
import type { Decision } from "./types";

const BACK: Decision = "BACK";
const REJECT: Decision = "REJECT";
const ABSTIENE: Decision = "ABSTAIN";

describe("calcVerdict", () => {
  it("calcula 3 de 4 respaldos como multiplicador 1.4x", () => {
    const result = calcVerdict([BACK, BACK, BACK, REJECT]);

    expect(result.backs).toBe(3);
    expect(result.voters).toBe(4);
    expect(result.fraction).toBeCloseTo(0.75);
    expect(result.multiplier).toBeCloseTo(1.4);
  });

  it("excluye la abstención del denominador y calcula 3 de 3 como 1.8x", () => {
    const result = calcVerdict([BACK, BACK, BACK, ABSTIENE]);

    expect(result.backs).toBe(3);
    expect(result.voters).toBe(3);
    expect(result.fraction).toBe(1);
    expect(result.multiplier).toBeCloseTo(1.8);
  });

  it("asigna fracción 0.5 y multiplicador 1.0x cuando no hay votos computables", () => {
    const result = calcVerdict([ABSTIENE, ABSTIENE, ABSTIENE, ABSTIENE]);

    expect(result.voters).toBe(0);
    expect(result.fraction).toBe(0.5);
    expect(result.multiplier).toBeCloseTo(1.0);
  });

  it("asigna fracción 0.5 cuando la lista de decisiones está vacía", () => {
    const result = calcVerdict([]);

    expect(result.fraction).toBe(0.5);
    expect(result.multiplier).toBeCloseTo(1.0);
  });

  it("calcula los multiplicadores de la tabla de la especificación", () => {
    expect(calcVerdict([REJECT, REJECT, REJECT, REJECT]).multiplier).toBeCloseTo(0.2);
    expect(calcVerdict([BACK, REJECT, REJECT, REJECT]).multiplier).toBeCloseTo(0.6);
    expect(calcVerdict([BACK, BACK, REJECT, REJECT]).multiplier).toBeCloseTo(1.0);
    expect(calcVerdict([BACK, BACK, BACK, BACK]).multiplier).toBeCloseTo(1.8);
  });
});

describe("multiplierFor", () => {
  it("aplica la fórmula 0.2 + 1.6 x fracción", () => {
    expect(multiplierFor(0)).toBeCloseTo(0.2);
    expect(multiplierFor(0.5)).toBeCloseTo(1.0);
    expect(multiplierFor(1)).toBeCloseTo(1.8);
  });
});
