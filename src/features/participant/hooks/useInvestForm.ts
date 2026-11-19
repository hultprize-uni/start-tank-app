"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { describeInvestmentIssue } from "../messages";
import { formatCoins, formatMultiplier } from "../format";
import {
  getInvestmentIssue,
  getMultiplier,
  type InvestmentIssue,
} from "../rules";
import type { InvestmentResult, WalletInfo } from "../types";

/*
 * Estado del formulario de inversión: monto en borrador, validación contra el mínimo, el tope de la
 * ronda y el saldo, atajos de monto y vista previa del retorno según los respaldos del jurado.
 */

/** Cantidad de jurados que sirve de base a la vista previa del retorno. */
const JURY_SIZE = 4;
/** Respaldos de jurado que se muestran en la vista previa. */
const PREVIEW_BACKS = [0, 2, 4] as const;

/** Atajo de monto: texto visible y valor que asigna al campo. */
export interface InvestShortcut {
  label: string;
  value: string;
}

/** Fila de la vista previa: escenario de respaldos, multiplicador y retorno del monto actual. */
export interface InvestPreviewRow {
  backs: number;
  multiplierText: string;
  /** Retorno formateado, o nulo mientras no hay monto válido de entrada. */
  payoutText: string | null;
  /** Tono de la fila: negativo cuando el retorno queda bajo el monto, neutro en el punto medio, positivo por encima. */
  tone: "low" | "neutral" | "high";
}

/** Estado y acciones del formulario de inversión. */
export interface InvestFormState {
  draft: string;
  setDraft: (value: string) => void;
  /** Monto entero que se enviaría; cero mientras el borrador no tiene un número válido. */
  amount: number;
  /** Motivo por el que el monto no es válido, o nulo. */
  issue: InvestmentIssue | null;
  /** Mensaje de error visible, o nulo cuando no hay error que mostrar. */
  errorMessage: string | null;
  /** Monto que aún puede invertirse en la ronda. */
  remainingCap: number;
  shortcuts: InvestShortcut[];
  preview: InvestPreviewRow[];
  canSubmit: boolean;
  /** Verdadero mientras la inversión se envía al servidor. */
  pending: boolean;
  /** Envía la inversión si el monto es válido. Limpia el borrador cuando la inversión se confirma. */
  submit: () => Promise<void>;
}

/** Convierte el borrador en un monto entero. Devuelve cero cuando el texto no es un número positivo. */
function parseDraft(draft: string): { hasInput: boolean; amount: number } {
  const trimmed = draft.trim();
  const parsed = Number(trimmed);
  const hasInput = trimmed !== "" && Number.isFinite(parsed) && parsed > 0;
  return { hasInput, amount: hasInput ? Math.floor(parsed) : 0 };
}

/** Formulario de inversión controlado por el borrador del asistente. */
export function useInvestForm(
  wallet: WalletInfo,
  onConfirm: (amount: number) => Promise<InvestmentResult>,
): InvestFormState {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const inFlightRef = useRef(false);

  const remainingCap = Math.max(0, wallet.roundCap - wallet.investedInRound);
  const { hasInput, amount } = parseDraft(draft);
  const issue = hasInput
    ? getInvestmentIssue({ amount, balance: wallet.balance, remainingCap })
    : null;
  const canSubmit = amount > 0 && issue === null && !pending;
  const errorMessage =
    issue !== null ? describeInvestmentIssue(issue, formatCoins(remainingCap)) : null;

  const shortcuts = useMemo<InvestShortcut[]>(
    () => [
      {
        label: `Mín ${formatCoins(EVENT_CONFIG.minInvestment)}`,
        value: String(EVENT_CONFIG.minInvestment),
      },
      {
        label: "25%",
        value: String(Math.floor(Math.min(remainingCap, wallet.balance * 0.25))),
      },
      {
        label: `Tope ${formatCoins(remainingCap)}`,
        value: String(Math.min(remainingCap, wallet.balance)),
      },
    ],
    [remainingCap, wallet.balance],
  );

  const preview = useMemo<InvestPreviewRow[]>(
    () =>
      PREVIEW_BACKS.map((backs) => {
        const multiplier = getMultiplier(backs, JURY_SIZE);
        const tone: InvestPreviewRow["tone"] = backs === 2 ? "neutral" : backs > 2 ? "high" : "low";
        return {
          backs,
          multiplierText: formatMultiplier(multiplier),
          payoutText: amount > 0 ? formatCoins(amount * multiplier) : null,
          tone,
        };
      }),
    [amount],
  );

  const submit = useCallback(async () => {
    // La referencia evita un segundo envío antes de que el render actualice canSubmit.
    if (!canSubmit || inFlightRef.current) return;
    inFlightRef.current = true;
    setPending(true);
    try {
      const result = await onConfirm(amount);
      if (result.ok) setDraft("");
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, [amount, canSubmit, onConfirm]);

  return {
    draft,
    setDraft,
    amount,
    issue,
    errorMessage,
    remainingCap,
    shortcuts,
    preview,
    canSubmit,
    pending,
    submit,
  };
}
