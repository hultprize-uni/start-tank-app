// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type {
  BetweenRounds,
  Closing,
  LastCall,
  OpenMarket,
  Settlement,
  Voting,
  Waiting,
} from "../types";
import { BetweenRoundsPhase } from "./BetweenRoundsPhase";
import { ClosingPhase } from "./ClosingPhase";
import { LastCallPhase } from "./LastCallPhase";
import { MarketPhase } from "./MarketPhase";
import { SettlementPhase } from "./SettlementPhase";
import { VotingPhase } from "./VotingPhase";
import { WaitingPhase } from "./WaitingPhase";

afterEach(cleanup);

const UPDATED_AT = "2026-11-08T15:00:00.000Z";
const ROUND = {
  number: 4,
  startup: { name: "Aqua Viva", sdg: { number: 6, name: "Agua limpia y saneamiento" } },
};

describe("WaitingPhase", () => {
  it("presenta la primera startup antes de que inicie la ronda", () => {
    const vm: Waiting = {
      phase: "WAITING",
      updatedAt: UPDATED_AT,
      nextRound: ROUND,
    };
    render(<WaitingPhase vm={vm} />);

    expect(screen.getByText("A continuación")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Aqua Viva" })).toBeInTheDocument();
    expect(
      screen.getByText("ODS 6: Agua limpia y saneamiento"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/por iniciar|entre rondas/i)).not.toBeInTheDocument();
  });
});

describe("MarketPhase", () => {
  it("muestra precio en vivo, monto acumulado e inversores de la ronda abierta", () => {
    const vm: OpenMarket = {
      phase: "MARKET",
      updatedAt: UPDATED_AT,
      round: ROUND,
      price: 148.5,
      accumulated: 9500,
      uniqueInvestors: 31,
    };
    render(<MarketPhase vm={vm} />);

    expect(screen.getByRole("heading", { level: 1, name: "Aqua Viva" })).toBeInTheDocument();
    expect(screen.getByLabelText("Precio 148.5")).toHaveTextContent("148.5");
    expect(screen.getByText("Monto acumulado")).toBeInTheDocument();
    expect(screen.getByText("9,500 IC")).toBeInTheDocument();
    expect(screen.getByText("Inversores")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.queryByText("Última llamada")).not.toBeInTheDocument();
  });
});

describe("LastCallPhase", () => {
  const base: LastCall = {
    phase: "LAST_CALL",
    updatedAt: UPDATED_AT,
    round: ROUND,
    price: 150,
    accumulated: 9800,
    uniqueInvestors: 33,
    secondsRemaining: 45,
  };

  it("muestra la cuenta regresiva de la última llamada", () => {
    render(<LastCallPhase vm={base} />);

    expect(screen.getByText("Última llamada")).toBeInTheDocument();
    expect(screen.getByLabelText("Tiempo restante de la última llamada")).toHaveTextContent(
      "00:45",
    );
    expect(screen.queryByText("El mercado cierra en segundos.")).not.toBeInTheDocument();
  });

  it("avisa del cierre inminente en los últimos diez segundos", () => {
    render(<LastCallPhase vm={{ ...base, secondsRemaining: 8 }} />);

    expect(screen.getByLabelText("Tiempo restante de la última llamada")).toHaveTextContent(
      "00:08",
    );
    expect(screen.getByText("El mercado cierra en segundos.")).toBeInTheDocument();
  });

  it("no muestra aviso de inminencia cuando la cuenta llega a cero", () => {
    render(<LastCallPhase vm={{ ...base, secondsRemaining: 0 }} />);

    expect(screen.getByLabelText("Tiempo restante de la última llamada")).toHaveTextContent(
      "00:00",
    );
    expect(screen.queryByText("El mercado cierra en segundos.")).not.toBeInTheDocument();
  });
});

describe("VotingPhase", () => {
  it("indica cuántos jurados han emitido voto sin revelar su sentido", () => {
    const vm: Voting = {
      phase: "VOTING",
      updatedAt: UPDATED_AT,
      round: ROUND,
      votesCast: 2,
      jurorsTotal: 4,
    };
    render(<VotingPhase vm={vm} />);

    expect(screen.getByRole("heading", { level: 1, name: "El jurado delibera" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "2 de 4 votos emitidos" })).toBeInTheDocument();
    expect(screen.getByText("2 / 4 votos emitidos")).toBeInTheDocument();
    expect(screen.queryByText(/respalda|rechaza/i)).not.toBeInTheDocument();
  });
});

describe("SettlementPhase", () => {
  const vm: Settlement = {
    phase: "SETTLEMENT",
    updatedAt: UPDATED_AT,
    round: ROUND,
    votes: [
      { juror: "Jurado 1", decision: "BACK" },
      { juror: "Jurado 2", decision: "BACK" },
      { juror: "Jurado 3", decision: "REJECT" },
      { juror: "Jurado 4", decision: "ABSTAIN" },
    ],
    backingFraction: 0.6667,
    multiplier: 1.4,
    amountInvested: 7500,
    roundReturn: 10500,
  };

  it("revela los cuatro votos, el multiplicador y el retorno de la ronda", () => {
    render(<SettlementPhase vm={vm} />);

    expect(screen.getByText("1.40 x")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 respaldos del jurado")).toBeInTheDocument();
    expect(screen.getByText("Jurado 3")).toBeInTheDocument();
    expect(screen.getByText("Rechaza")).toBeInTheDocument();
    expect(screen.getByText("Se abstiene")).toBeInTheDocument();
    expect(screen.getAllByText("Respalda")).toHaveLength(2);
    expect(
      screen.getByText("Retorno de la ronda: 10,500 IC sobre 7,500 IC invertidos."),
    ).toBeInTheDocument();
  });

  it("colorea el multiplicador alto con el tono de respaldo", () => {
    render(<SettlementPhase vm={{ ...vm, multiplier: 1.6 }} />);
    expect(screen.getByText("1.60 x").className).toMatch(/multHigh/);
  });
});

describe("BetweenRoundsPhase", () => {
  const investors = Array.from({ length: 9 }, (_, index) => ({
    position: index + 1,
    name: `Inversionista ${index + 1}`,
    balance: 12_000 - index * 100,
  }));
  const startups = [
    { position: 1, name: "Aqua Viva", accumulated: 9500, price: 148.5 },
    { position: 2, name: "Huella Verde", accumulated: 4750, price: 124 },
  ];
  const vm: BetweenRounds = {
    phase: "BETWEEN_ROUNDS",
    updatedAt: UPDATED_AT,
    closedRound: ROUND,
    investors,
    startups,
  };

  it("lista los inversionistas con el recorte visible y las startups", () => {
    render(<BetweenRoundsPhase vm={vm} />);

    expect(screen.getByRole("heading", { level: 1, name: "Clasificación" })).toBeInTheDocument();
    expect(screen.getByText("Ronda 4 cerrada")).toBeInTheDocument();
    const investorList = screen.getByRole("region", { name: "Inversionistas" });
    expect(within(investorList).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("Mostrando 7 de 9 inversionistas")).toBeInTheDocument();
    expect(screen.getByText("Inversionista 1")).toBeInTheDocument();
    expect(screen.getByText("9,500 IC · 148.5")).toBeInTheDocument();
  });
});

describe("ClosingPhase", () => {
  const vm: Closing = {
    phase: "CLOSING",
    updatedAt: UPDATED_AT,
    winner: {
      name: "AgroSense",
      sdg: { number: 2, name: "Hambre cero" },
      score: 0.69,
      backingFraction: 0.75,
      investorPercentage: 0.6,
    },
    top3: [
      { position: 1, name: "Ana", balance: 18400 },
      { position: 2, name: "Luis", balance: 17900 },
      { position: 3, name: "Eva", balance: 16200 },
    ],
    bestEye: { name: "Luis", hits: 5 },
  };

  it("declara la ganadora, su puntaje, el top 3 y el mejor ojo", () => {
    render(<ClosingPhase vm={vm} />);

    expect(screen.getByRole("heading", { level: 1, name: "AgroSense" })).toBeInTheDocument();
    expect(screen.getByText("69")).toBeInTheDocument();
    expect(screen.getByText("de 100 puntos")).toBeInTheDocument();
    expect(screen.getByText("Pase directo a la gran final")).toBeInTheDocument();
    const top = screen.getByRole("heading", { level: 2, name: "Top 3 inversionistas" });
    expect(top).toBeInTheDocument();
    expect(screen.getByText("18,400 IC")).toBeInTheDocument();
    expect(screen.getByLabelText("Mejor ojo")).toHaveTextContent("Luis con 5 aciertos");
  });
});
