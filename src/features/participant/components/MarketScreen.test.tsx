// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MarketInfo, RoundInfo, StartupInfo, WalletInfo } from "../types";
import { MarketScreen } from "./MarketScreen";

afterEach(cleanup);

const round: RoundInfo = { number: 2, total: 5 };
const startup: StartupInfo = {
  name: "Nodo Solar",
  sdg: "ODS 7 · Energía asequible",
  description: "",
};
const market: MarketInfo = {
  price: 120,
  priceChange: 20,
  totalRaised: 4_000,
  investorCount: 18,
};
const wallet: WalletInfo = { balance: 9_000, investedInRound: 500, roundCap: 2_700 };

describe("MarketScreen en mercado abierto", () => {
  it("muestra la startup, el precio en vivo y la etiqueta de mercado abierto", () => {
    render(
      <MarketScreen
        round={round}
        startup={startup}
        market={market}
        wallet={wallet}
        countdownSeconds={null}
      />,
    );

    expect(screen.getByText("Mercado abierto")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Mercado de la ronda 2 de 5" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Nodo Solar" })).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("▲ +20")).toBeInTheDocument();
    expect(screen.getByText("4,000")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("expresa el uso del tope de la ronda como barra de progreso accesible", () => {
    render(
      <MarketScreen
        round={round}
        startup={startup}
        market={market}
        wallet={wallet}
        countdownSeconds={null}
      />,
    );

    const bar = screen.getByRole("progressbar", { name: "Uso del tope de la ronda" });
    expect(bar).toHaveAttribute("aria-valuenow", "500");
    expect(bar).toHaveAttribute("aria-valuemax", "2700");
    expect(bar).toHaveAttribute("aria-valuetext", "500 de 2,700 coins");
  });

  it("no muestra la cuenta regresiva fuera de la última llamada", () => {
    render(
      <MarketScreen
        round={round}
        startup={startup}
        market={market}
        wallet={wallet}
        countdownSeconds={null}
      />,
    );

    expect(screen.queryByText("Cierre automático en")).not.toBeInTheDocument();
  });

  it("ofrece el botón de inversión cuando recibe la acción del móvil", async () => {
    const user = userEvent.setup();
    const onInvest = vi.fn();
    render(
      <MarketScreen
        round={round}
        startup={startup}
        market={market}
        wallet={wallet}
        countdownSeconds={null}
        onInvest={onInvest}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Invertir" }));

    expect(onInvest).toHaveBeenCalledTimes(1);
  });

  it("omite el botón de inversión en el escritorio, donde el formulario va en línea", () => {
    render(
      <MarketScreen
        round={round}
        startup={startup}
        market={market}
        wallet={wallet}
        countdownSeconds={null}
      />,
    );

    expect(screen.queryByRole("button", { name: "Invertir" })).not.toBeInTheDocument();
  });

  it("muestra una variación negativa del precio con el signo correspondiente", () => {
    render(
      <MarketScreen
        round={round}
        startup={startup}
        market={{ ...market, price: 90, priceChange: -10 }}
        wallet={wallet}
        countdownSeconds={null}
      />,
    );

    expect(screen.getByText("▼ −10")).toBeInTheDocument();
  });
});

describe("MarketScreen en última llamada", () => {
  it("muestra la cuenta regresiva con el tiempo restante y la barra de avance", () => {
    render(
      <MarketScreen
        round={round}
        startup={startup}
        market={market}
        wallet={wallet}
        countdownSeconds={42}
      />,
    );

    expect(screen.getByText("Última llamada")).toBeInTheDocument();
    expect(screen.getByText("Cierre automático en")).toBeInTheDocument();
    expect(screen.getByLabelText("Tiempo restante de la última llamada")).toHaveTextContent("00:42");
    expect(screen.getByRole("progressbar", { name: "Barra de tiempo de la última llamada" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
  });

  it("resalta el contador en los últimos diez segundos", () => {
    render(
      <MarketScreen
        round={round}
        startup={startup}
        market={market}
        wallet={wallet}
        countdownSeconds={8}
      />,
    );

    expect(screen.getByLabelText("Tiempo restante de la última llamada")).toHaveTextContent("00:08");
    expect(screen.getByLabelText("Tiempo restante de la última llamada").className).toMatch(/warning/);
  });
});
