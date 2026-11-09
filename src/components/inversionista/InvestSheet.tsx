"use client";

import { useState } from "react";
import { EVENT_CONFIG } from "@/lib/domain/config";
import {
  getInvestmentIssue,
  getMultiplier,
  type InvestmentIssue,
} from "@/lib/api/investor.rules";
import type { WalletInfo } from "@/lib/api/investor.types";
import { ActionButton } from "./ActionButton";
import { formatCoins, formatMultiplier } from "./format";
import styles from "./InvestSheet.module.css";

interface InvestSheetProps {
  startupName: string;
  wallet: WalletInfo;
  onConfirm: (amount: number) => void;
  onClose: () => void;
}

/** Números de respaldo de jurado que alimentan la vista previa del retorno. */
const PREVIEW_BACKS = [0, 2, 4] as const;
const JURY_SIZE = 4;

const ISSUE_MESSAGES: Record<InvestmentIssue, (remainingCap: number) => string> = {
  "below-min": () => `El mínimo es ${formatCoins(EVENT_CONFIG.minInvestment)} coins.`,
  "above-cap": (remainingCap) => `Tu tope en esta ronda es ${formatCoins(remainingCap)}.`,
  "above-balance": () => "Saldo insuficiente.",
};

/** Hoja para elegir el monto de inversión, con vista previa del retorno según el jurado. */
export function InvestSheet({ startupName, wallet, onConfirm, onClose }: InvestSheetProps) {
  const [draft, setDraft] = useState("");

  const remainingCap = Math.max(0, wallet.roundCap - wallet.investedInRound);
  const amount = Math.floor(Number(draft)) || 0;
  const issue = amount > 0 ? getInvestmentIssue({ amount, balance: wallet.balance, remainingCap }) : null;
  const isValid = amount > 0 && issue === null;
  const errorMessage = issue ? ISSUE_MESSAGES[issue](remainingCap) : "";

  const chips = [
    { label: `Mín ${formatCoins(EVENT_CONFIG.minInvestment)}`, value: EVENT_CONFIG.minInvestment },
    { label: "25 %", value: Math.floor(Math.min(remainingCap, wallet.balance * 0.25)) },
    { label: `Tope ${formatCoins(remainingCap)}`, value: Math.min(remainingCap, wallet.balance) },
  ];

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="invest-title">
        <div className={styles.heading}>
          <h2 id="invest-title" className={styles.title}>
            ¿Cuánto inviertes?
          </h2>
          <span className={styles.startup}>en {startupName}</span>
        </div>

        <label className={`${styles.field} ${errorMessage ? styles.fieldError : ""}`}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className={styles.input}
            aria-label="Monto a invertir en coins"
            aria-invalid={errorMessage !== ""}
          />
          <span className={styles.unit}>coins</span>
        </label>
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>

        <div className={styles.chips}>
          {chips.map((chip) => (
            <ActionButton
              key={chip.label}
              variant="ghost"
              size="md"
              onClick={() => setDraft(String(chip.value))}
            >
              {chip.label}
            </ActionButton>
          ))}
        </div>

        <div className={styles.preview}>
          <span className={styles.previewLabel}>Retorno según el jurado</span>
          {PREVIEW_BACKS.map((backs) => {
            const multiplier = getMultiplier(backs, JURY_SIZE);
            const payout = amount > 0 ? formatCoins(amount * multiplier) : "—";
            const toneClass =
              backs === 2 ? styles.previewNeutral : backs > 2 ? styles.previewHigh : styles.previewLow;
            return (
              <div key={backs} className={styles.previewRow}>
                <span className={styles.previewScenario}>
                  {backs} de {JURY_SIZE} respaldan · {formatMultiplier(multiplier)}
                </span>
                <span className={`${styles.previewValue} ${toneClass}`}>{payout}</span>
              </div>
            );
          })}
        </div>

        <p className={styles.note}>No podrás retirar tu inversión antes del veredicto.</p>

        <ActionButton
          variant={isValid ? "primary" : "muted"}
          size="lg"
          disabled={!isValid}
          onClick={() => onConfirm(amount)}
        >
          Confirmar inversión
        </ActionButton>
      </div>
    </>
  );
}
