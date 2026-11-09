import { describe, expect, it } from "vitest";
import { bestEye, countHits, pickWinner, startupScore } from "./scoring";

describe("startupScore", () => {
  it("calcula 0.6 x fracción más 0.4 x porcentaje de asistentes", () => {
    // Fracción 1.00 y 30 por ciento de asistentes: 0.6 + 0.12 = 0.72.
    expect(startupScore(1, 0.3)).toBeCloseTo(0.72);
  });

  it("devuelve 0 cuando no hay respaldos ni inversiones", () => {
    expect(startupScore(0, 0)).toBe(0);
  });
});

describe("pickWinner", () => {
  it("elige la startup con el puntaje más alto", () => {
    const ganadora = pickWinner([
      { id: "A", fraction: 0.5, investorPct: 0.9 },
      { id: "B", fraction: 1, investorPct: 0.3 },
      { id: "C", fraction: 0.25, investorPct: 0.2 },
    ]);

    // A: 0.30 + 0.36 = 0.66; B: 0.72; C: 0.23.
    expect(ganadora?.id).toBe("B");
  });

  it("desempata por la mayor fracción de respaldo cuando el puntaje coincide", () => {
    // Ambas startups suman 0.5: X con fracción 0.5 y tracción 0.5; Y con fracción 0.75 y tracción 0.125.
    const ganadora = pickWinner([
      { id: "X", fraction: 0.5, investorPct: 0.5 },
      { id: "Y", fraction: 0.75, investorPct: 0.125 },
    ]);

    expect(ganadora?.id).toBe("Y");
  });

  it("conserva la primera startup cuando puntaje y fracción coinciden", () => {
    const ganadora = pickWinner([
      { id: "P", fraction: 0.5, investorPct: 0.5 },
      { id: "Q", fraction: 0.5, investorPct: 0.5 },
    ]);

    expect(ganadora?.id).toBe("P");
  });

  it("devuelve undefined cuando no hay startups", () => {
    expect(pickWinner([])).toBeUndefined();
  });
});

describe("countHits", () => {
  it("cuenta las inversiones en startups con 3 o 4 respaldos", () => {
    expect(countHits([4, 3, 2, 1, 0])).toBe(2);
  });

  it("cuenta como acierto las inversiones con 3 respaldos de 3 votos", () => {
    expect(countHits([3])).toBe(1);
  });

  it("devuelve 0 cuando no hay inversiones", () => {
    expect(countHits([])).toBe(0);
  });
});

describe("bestEye", () => {
  it("identifica al asistente con mayor número de aciertos", () => {
    const mejor = bestEye([
      { id: "ana", investmentBacks: [4, 1, 0] },
      { id: "luis", investmentBacks: [3, 3, 4, 2] },
      { id: "marta", investmentBacks: [0] },
    ]);

    expect(mejor).toEqual({ id: "luis", hits: 3 });
  });

  it("no premia la cantidad de inversiones que no son aciertos", () => {
    const mejor = bestEye([
      { id: "prudente", investmentBacks: [3] },
      { id: "arriesgado", investmentBacks: [1, 1, 1, 1] },
    ]);

    expect(mejor).toEqual({ id: "prudente", hits: 1 });
  });

  it("devuelve undefined cuando no hay asistentes", () => {
    expect(bestEye([])).toBeUndefined();
  });
});
