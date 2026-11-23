// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PhaseClock } from "@/shared/domain/types";
import type { MarketInfo, RoundInfo, StartupInfo, WalletInfo } from "../types";
import { MarketScreen } from "./MarketScreen";

afterEach(cleanup);

const round: RoundInfo = { number: 2, total: 5 };
const startup: StartupInfo = {
  name: "Nodo Solar",
  sdg: "ODS 7 · Energía asequible y no contaminante",
  description: "",
  logoUrl: null,
};
const market: MarketInfo = { price: 110, priceChange: 10, totalRaised: 2_200, investorCount: 9 };
const wallet: WalletInfo = { balance: 9_000, investedInRound: 0, roundCap: 2_700, alreadyInvested: false };

function clockEndingIn(seconds: number, paused = false): PhaseClock {
  return {
    serverTime: new Date().toISOString(),
    phaseEndsAt: paused ? null : new Date(Date.now() + seconds * 1000 - 500).toISOString(),
    paused,
    pausedSeconds: paused ? seconds : null,
  };
}

function renderMarket(overrides: Partial<Parameters<typeof MarketScreen>[0]> = {}) {
  const onInvest = vi.fn();
  render(
    <MarketScreen
      round={round}
      startup={startup}
      market={market}
      wallet={wallet}
      lastCall={false}
      clock={clockEndingIn(600)}
      onInvest={onInvest}
      {...overrides}
    />,
  );
  return onInvest;
}

describe("MarketScreen", () => {
  it("muestra el mercado abierto con el precio, el saldo y el cierre", () => {
    renderMarket();

    expect(screen.getByText("Mercado abierto")).toBeInTheDocument();
    expect(screen.getByText("9,000")).toBeInTheDocument();
    expect(screen.getByText("Tope 2,700")).toBeInTheDocument();
    expect(screen.getByText("Cierra en 10:00")).toBeInTheDocument();
  });

  it("abre la inversión con el botón Invertir", async () => {
    const onInvest = renderMarket();
    await userEvent.setup().click(screen.getByRole("button", { name: "Invertir" }));
    expect(onInvest).toHaveBeenCalledOnce();
  });

  it("muestra la última llamada con su cuenta regresiva del servidor", () => {
    renderMarket({ lastCall: true, clock: clockEndingIn(42) });

    expect(screen.getByText("Última llamada")).toBeInTheDocument();
    expect(screen.getByLabelText("Tiempo restante de la última llamada")).toHaveTextContent("00:42");
  });

  it("bloquea la inversión con el mercado en pausa", () => {
    renderMarket({ clock: clockEndingIn(120, true) });

    expect(screen.getByText("Mercado en pausa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invertir" })).not.toBeInTheDocument();
  });

  it("muestra que ya invirtió y no ofrece otra inversión", () => {
    renderMarket({ wallet: { ...wallet, balance: 8_000, investedInRound: 1_000, alreadyInvested: true } });

    expect(screen.getByText("Ya invertiste en esta ronda")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invertir" })).not.toBeInTheDocument();
  });
});
