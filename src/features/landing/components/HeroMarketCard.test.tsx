// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroMarketCard } from "./HeroMarketCard";
import { marketFrame } from "./market-demo";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("HeroMarketCard", () => {
  it("muestra la startup de demo y el precio inicial determinista", () => {
    render(<HeroMarketCard />);

    expect(screen.getAllByText(/AguaClara/)).toHaveLength(2);
    expect(screen.getByText("ODS 6: Agua limpia")).toBeInTheDocument();
    expect(screen.getByText("Ronda 2 de 5")).toBeInTheDocument();
    expect(screen.getByText(marketFrame(0).price)).toBeInTheDocument();
  });

  it("actualiza el precio al avanzar el temporizador de la demo", () => {
    vi.useFakeTimers();
    render(<HeroMarketCard />);

    expect(screen.getByText(marketFrame(0).price)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1400);
    });

    expect(screen.getByText(marketFrame(1).price)).toBeInTheDocument();
  });

  it("mantiene fijo el cuadro inicial cuando el usuario prefiere movimiento reducido", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    render(<HeroMarketCard />);
    expect(screen.getByText(marketFrame(0).price)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    expect(screen.getByText(marketFrame(0).price)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
