// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvestmentResult, WalletInfo } from "../types";
import { useInvestForm } from "./useInvestForm";

afterEach(cleanup);

/** Billetera con saldo de 9,000 y tope de la ronda de 30 %, sin inversión previa. */
const wallet: WalletInfo = { balance: 9_000, investedInRound: 0, roundCap: 2_700, alreadyInvested: false };

function setup(overrides: Partial<WalletInfo> = {}, result: InvestmentResult = { ok: true }) {
  const onConfirm = vi.fn<(amount: number) => Promise<InvestmentResult>>(async () => result);
  const hook = renderHook(() => useInvestForm({ ...wallet, ...overrides }, onConfirm));
  return { ...hook, onConfirm };
}

describe("useInvestForm", () => {
  it("no muestra error ni permite revisar mientras el borrador está vacío", () => {
    const { result } = setup();
    expect(result.current.amount).toBe(0);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.canReview).toBe(false);
  });

  it("rechaza montos bajo el mínimo y sobre el tope", () => {
    const { result } = setup();
    act(() => result.current.setDraft("249"));
    expect(result.current.issue).toBe("below-min");
    act(() => result.current.setDraft("2701"));
    expect(result.current.issue).toBe("above-cap");
  });

  it("limita Máx al tope y al saldo", () => {
    expect(setup().result.current.maxAmount).toBe(2_700);
    expect(setup({ balance: 300, roundCap: 2_700 }).result.current.maxAmount).toBe(300);
  });

  it("calcula lo que recibiría con cada puntaje del jurado", () => {
    const { result } = setup();
    act(() => result.current.setDraft("1000"));
    expect(result.current.preview.map((row) => row.payoutText)).toEqual([
      "200",
      "600",
      "1,000",
      "1,400",
      "1,800",
    ]);
    expect(result.current.preview.map((row) => row.tone)).toEqual(["low", "low", "neutral", "high", "high"]);
  });

  it("solo envía desde el paso de confirmación y vuelve a editar al cambiar el monto", async () => {
    const { result, onConfirm } = setup();
    act(() => result.current.setDraft("500"));

    await act(() => result.current.submit());
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => result.current.review());
    expect(result.current.step).toBe("confirm");
    await act(() => result.current.submit());
    expect(onConfirm).toHaveBeenCalledWith(500);
    expect(result.current.step).toBe("amount");
  });

  it("conserva el monto si el servidor rechaza", async () => {
    const { result } = setup({}, { ok: false, message: "El mercado ya cerró." });
    act(() => result.current.setDraft("500"));
    act(() => result.current.review());
    await act(() => result.current.submit());
    expect(result.current.draft).toBe("500");
  });
});
