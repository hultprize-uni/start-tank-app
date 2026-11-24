import { describe, expect, it } from "vitest";
import { computeEventResults, finalScore } from "./results";

const CLOSED = new Date("2026-11-26T21:40:00.000Z");

describe("finalScore", () => {
  it("weights the jury 60 percent and the investors 40 percent", () => {
    // 0.6 × (4.4 − 1) / 4 + 0.4 × 0.78 = 0.51 + 0.312
    expect(finalScore(4.4, 78, 100)).toBe(0.822);
  });

  it("gives no jury points to a cancelled round and no share without attendees", () => {
    expect(finalScore(null, 10, 100)).toBe(0.04);
    expect(finalScore(5, 10, 0)).toBe(0.6);
  });
});

describe("computeEventResults", () => {
  const startups = [
    { id_ronda: "1", nombre: "AgroSense", puntaje_jurado: 4, inversores_unicos: 50 },
    { id_ronda: "2", nombre: "SolRed", puntaje_jurado: 4.4, inversores_unicos: 78 },
    { id_ronda: "3", nombre: "EduRuta", puntaje_jurado: null, inversores_unicos: 90 },
  ];
  const investors = [
    { id_usuario: "1", nombre: "Ana", saldo: 11_000, aciertos: 2 },
    { id_usuario: "2", nombre: "Lucía", saldo: 13_500, aciertos: 4 },
    { id_usuario: "3", nombre: "Carlos", saldo: 12_000, aciertos: 4 },
    { id_usuario: "4", nombre: "Bea", saldo: 9_000, aciertos: 0 },
  ];

  it("sorts startups by final score and names the winner", () => {
    const { ranked, summary } = computeEventResults(startups, investors, 100, CLOSED);
    expect(ranked.map((row) => row.nombre)).toEqual(["SolRed", "AgroSense", "EduRuta"]);
    expect(summary.winnerStartup).toEqual({
      name: "SolRed",
      juryScore: 4.4,
      investorShare: 0.78,
      finalScore: 0.822,
    });
  });

  it("breaks a final-score tie with the jury score", () => {
    const { ranked } = computeEventResults(
      [
        { id_ronda: "1", nombre: "A", puntaje_jurado: 3, inversores_unicos: 30 },
        { id_ronda: "2", nombre: "B", puntaje_jurado: 3.4, inversores_unicos: 6 },
      ],
      [],
      100,
      CLOSED,
    );
    // A: 0.3 + 0.12 = 0.42; B: 0.36 + 0.024 = 0.384. Sin empate, gana A.
    expect(ranked[0].nombre).toBe("A");
  });

  it("returns the top 3 by balance and the best eye, first by position on ties", () => {
    const { summary } = computeEventResults(startups, investors, 100, CLOSED);
    expect(summary.topInvestors.map((row) => row.name)).toEqual(["Lucía", "Carlos", "Ana"]);
    expect(summary.bestEye).toEqual({ name: "Lucía", hits: 4 });
    expect(summary.closedAt).toBe(CLOSED.toISOString());
  });

  it("has no best eye when nobody hit", () => {
    const { summary } = computeEventResults(startups, [investors[3]], 100, CLOSED);
    expect(summary.bestEye).toBeNull();
  });
});
