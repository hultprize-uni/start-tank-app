"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { payoutPreview } from "@/shared/domain/investment";
import { multiplierForScore } from "@/shared/domain/verdict";
import { describeInvestmentIssue } from "../messages";
import { formatCoins, formatMultiplier } from "../format";
import { getInvestmentIssue, type InvestmentIssue } from "../rules";
import type { InvestmentResult, WalletInfo } from "../types";

/*
 * Estado del formulario de inversión: monto en borrador, validación contra el mínimo, el tope y el
 * saldo, atajos de monto, vista previa del retorno con cada puntaje del jurado (RF-24) y
 * confirmación en dos pasos: primero se elige el monto, después se confirma.
 */

/** Atajo de monto: texto visible y valor que asigna al campo. */
export interface InvestShortcut {
  label: string;
  value: string;
}

/** Fila de la vista previa: puntaje del jurado, multiplicador y lo que recibiría. */
export interface InvestPreviewRow {
  score: number;
  multiplierText: string;
  /** Retorno formateado, o nulo mientras no hay monto válido. */
  payoutText: string | null;
  /** Negativo bajo 1.0x, neutro en 1.0x y positivo por encima. */
  tone: "low" | "neutral" | "high";
}

export type InvestStep = "amount" | "confirm";

export interface InvestFormState {
  draft: string;
  setDraft: (value: string) => void;
  /** Monto entero que se enviaría; cero mientras el borrador no tiene un número válido. */
  amount: number;
  issue: InvestmentIssue | null;
  errorMessage: string | null;
  /** Monto máximo de la ronda: el tope, sin pasar del saldo. */
  maxAmount: number;
  shortcuts: InvestShortcut[];
  preview: InvestPreviewRow[];
  step: InvestStep;
  /** Pasa al paso de confirmación si el monto es válido. */
  review: () => void;
  /** Vuelve a editar el monto. */
  back: () => void;
  canReview: boolean;
  pending: boolean;
  /** Envía la inversión. Solo actúa en el paso de confirmación. */
  submit: () => Promise<void>;
}

function parseDraft(draft: string): { hasInput: boolean; amount: number } {
  const trimmed = draft.trim();
  const parsed = Number(trimmed);
  const hasInput = trimmed !== "" && Number.isFinite(parsed) && parsed > 0;
  return { hasInput, amount: hasInput ? Math.floor(parsed) : 0 };
}

function toneOf(multiplier: number): InvestPreviewRow["tone"] {
  if (multiplier < 1) return "low";
  return multiplier > 1 ? "high" : "neutral";
}

export function useInvestForm(
  wallet: WalletInfo,
  onConfirm: (amount: number) => Promise<InvestmentResult>,
): InvestFormState {
  const [draft, setDraftState] = useState("");
  const [step, setStep] = useState<InvestStep>("amount");
  const [pending, setPending] = useState(false);
  const inFlightRef = useRef(false);

  const maxAmount = Math.floor(Math.min(wallet.roundCap, wallet.balance));
  const { hasInput, amount } = parseDraft(draft);
  const issue = hasInput
    ? getInvestmentIssue({ amount, balance: wallet.balance, remainingCap: wallet.roundCap })
    : null;
  const canReview = amount > 0 && issue === null && !pending;
  const errorMessage = issue !== null ? describeInvestmentIssue(issue, formatCoins(wallet.roundCap)) : null;

  const setDraft = useCallback((value: string) => {
    setDraftState(value);
    setStep("amount");
  }, []);

  const shortcuts = useMemo<InvestShortcut[]>(
    () => [
      { label: formatCoins(EVENT_CONFIG.minInvestment), value: String(EVENT_CONFIG.minInvestment) },
      { label: "25%", value: String(Math.floor(Math.min(maxAmount, wallet.balance * 0.25))) },
      { label: "Máx", value: String(maxAmount) },
    ],
    [maxAmount, wallet.balance],
  );

  const preview = useMemo<InvestPreviewRow[]>(
    () =>
      payoutPreview(amount, multiplierForScore).map((row) => ({
        score: row.score,
        multiplierText: formatMultiplier(row.multiplier),
        payoutText: amount > 0 ? formatCoins(row.payout) : null,
        tone: toneOf(row.multiplier),
      })),
    [amount],
  );

  const review = useCallback(() => {
    if (canReview) setStep("confirm");
  }, [canReview]);

  const back = useCallback(() => setStep("amount"), []);

  const submit = useCallback(async () => {
    // La referencia evita un segundo envío antes de que el render actualice el estado.
    if (step !== "confirm" || !canReview || inFlightRef.current) return;
    inFlightRef.current = true;
    setPending(true);
    try {
      const result = await onConfirm(amount);
      if (result.ok) setDraftState("");
      setStep("amount");
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, [amount, canReview, onConfirm, step]);

  return {
    draft,
    setDraft,
    amount,
    issue,
    errorMessage,
    maxAmount,
    shortcuts,
    preview,
    step,
    review,
    back,
    canReview,
    pending,
    submit,
  };
}
