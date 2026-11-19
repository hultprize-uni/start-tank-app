// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { InvestmentResult, WalletInfo } from "../types";
import { useInvestForm } from "./useInvestForm";

/** Billetera con saldo de 9,000 y tope de la ronda de 30 %, sin inversión previa. */
const wallet: WalletInfo = { balance: 9_000, investedInRound: 0, roundCap: 2_700 };

function setup(overrides: Partial<WalletInfo> = {}, result: InvestmentResult = { ok: true }) {
  const onConfirm = vi.fn(async (_amount: number) => result);
  const hook = renderHook(
    ({ current }: { current: WalletInfo }) => useInvestForm(current, onConfirm),
    { initialProps: { current: { ...wallet, ...overrides } } },
  );
  return { ...hook, onConfirm };
}

describe("useInvestForm", () => {
  it("no muestra error ni permite enviar mientras el borrador está vacío", () => {
    const { result } = setup();

    expect(result.current.draft).toBe("");
    expect(result.current.amount).toBe(0);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.canSubmit).toBe(false);
  });

  it("rechaza montos menores que el mínimo de 250 coins", () => {
    const { result } = setup();

    act(() => result.current.setDraft("100"));

    expect(result.current.issue).toBe("below-min");
    expect(result.current.errorMessage).toBe("El mínimo es 250 coins.");
    expect(result.current.canSubmit).toBe(false);
  });

  it("acepta el monto mínimo y lo envía al confirmar", async () => {
    const { result, onConfirm } = setup();

    act(() => result.current.setDraft("250"));
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.canSubmit).toBe(true);

    await act(() => result.current.submit());

    expect(onConfirm).toHaveBeenCalledWith(250);
  });

  it("rechaza montos que superan el tope restante de la ronda al 30 % del saldo", () => {
    const { result } = setup({ investedInRound: 2_500 });

    act(() => result.current.setDraft("300"));

    expect(result.current.remainingCap).toBe(200);
    expect(result.current.issue).toBe("above-cap");
    expect(result.current.errorMessage).toBe("Tu tope en esta ronda es 200.");
  });

  it("rechaza montos que superan el saldo disponible", () => {
    const { result } = setup({ balance: 200, roundCap: 2_000 });

    act(() => result.current.setDraft("250"));

    expect(result.current.issue).toBe("above-balance");
    expect(result.current.errorMessage).toBe("Saldo insuficiente.");
  });

  it("trunca los decimales y no envía si el monto queda bajo el mínimo", () => {
    const { result } = setup();

    act(() => result.current.setDraft("249.9"));
    expect(result.current.amount).toBe(249);
    expect(result.current.canSubmit).toBe(false);

    act(() => result.current.setDraft("250.8"));
    expect(result.current.amount).toBe(250);
    expect(result.current.canSubmit).toBe(true);
  });

  it("ofrece atajos con el mínimo, un cuarto del saldo y el tope de la ronda", () => {
    const { result } = setup();

    expect(result.current.shortcuts).toEqual([
      { label: "Mín 250", value: "250" },
      { label: "25%", value: "2250" },
      { label: "Tope 2,700", value: "2700" },
    ]);
  });

  it("limita el atajo de un cuarto del saldo al tope restante", () => {
    const { result } = setup({ investedInRound: 2_000 });

    expect(result.current.shortcuts[1]).toEqual({ label: "25%", value: "700" });
    expect(result.current.shortcuts[2]).toEqual({ label: "Tope 700", value: "700" });
  });

  it("calcula la vista previa del retorno para 0, 2 y 4 respaldos", () => {
    const { result } = setup();

    act(() => result.current.setDraft("1000"));

    expect(result.current.preview).toEqual([
      { backs: 0, multiplierText: "0.2x", payoutText: "200", tone: "low" },
      { backs: 2, multiplierText: "1.0x", payoutText: "1,000", tone: "neutral" },
      { backs: 4, multiplierText: "1.8x", payoutText: "1,800", tone: "high" },
    ]);
  });

  it("no muestra retornos en la vista previa sin monto válido", () => {
    const { result } = setup();

    expect(result.current.preview.every((row) => row.payoutText === null)).toBe(true);
  });

  it("limpia el borrador cuando la inversión se confirma", async () => {
    const { result } = setup();

    act(() => result.current.setDraft("500"));
    await act(() => result.current.submit());

    expect(result.current.draft).toBe("");
  });

  it("conserva el borrador cuando el servidor rechaza la inversión", async () => {
    const { result } = setup({}, { ok: false, message: "El mercado ya cerró." });

    act(() => result.current.setDraft("500"));
    await act(() => result.current.submit());

    expect(result.current.draft).toBe("500");
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it("no envía dos veces mientras una inversión está pendiente", async () => {
    const { result, onConfirm } = setup();

    act(() => result.current.setDraft("500"));
    await act(async () => {
      void result.current.submit();
      void result.current.submit();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
