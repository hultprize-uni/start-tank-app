import { describe, expect, it } from "vitest";
import { calcVerdict, multiplierFor } from "./verdict";
import type { Decision } from "./types";

const RESPALDA: Decision = "RESPALDA";
const RECHAZA: Decision = "RECHAZA";
const ABSTIENE: Decision = "SE_ABSTIENE";

describe("calcVerdict", () => {
  it("calcula 3 de 4 respaldos como multiplicador 1.4x", () => {
    const result = calcVerdict([RESPALDA, RESPALDA, RESPALDA, RECHAZA]);

    expect(result.backs).toBe(3);
    expect(result.voters).toBe(4);
    expect(result.fraction).toBeCloseTo(0.75);
    expect(result.multiplier).toBeCloseTo(1.4);
  });

  it("excluye la abstención del denominador y calcula 3 de 3 como 1.8x", () => {
    const result = calcVerdict([RESPALDA, RESPALDA, RESPALDA, ABSTIENE]);

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
    expect(calcVerdict([RECHAZA, RECHAZA, RECHAZA, RECHAZA]).multiplier).toBeCloseTo(0.2);
    expect(calcVerdict([RESPALDA, RECHAZA, RECHAZA, RECHAZA]).multiplier).toBeCloseTo(0.6);
    expect(calcVerdict([RESPALDA, RESPALDA, RECHAZA, RECHAZA]).multiplier).toBeCloseTo(1.0);
    expect(calcVerdict([RESPALDA, RESPALDA, RESPALDA, RESPALDA]).multiplier).toBeCloseTo(1.8);
  });
});

describe("multiplierFor", () => {
  it("aplica la fórmula 0.2 + 1.6 x fracción", () => {
    expect(multiplierFor(0)).toBeCloseTo(0.2);
    expect(multiplierFor(0.5)).toBeCloseTo(1.0);
    expect(multiplierFor(1)).toBeCloseTo(1.8);
  });
});
