"use client";

import { useId } from "react";
import type { InvestmentResult, WalletInfo } from "../types";
import { InvestForm } from "./InvestForm";
import styles from "./InvestPanel.module.css";

interface InvestPanelProps {
  startupName: string;
  wallet: WalletInfo;
  onConfirm: (amount: number) => Promise<InvestmentResult>;
}

/** Panel de inversión en línea para escritorio: el formulario permanece visible durante el mercado. */
export function InvestPanel({ startupName, wallet, onConfirm }: InvestPanelProps) {
  const headingId = useId();

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.heading}>
        <h2 id={headingId} className={styles.title}>
          ¿Cuánto inviertes?
        </h2>
        <span className={styles.startup}>en {startupName}</span>
      </header>
      <InvestForm wallet={wallet} onConfirm={onConfirm} />
    </section>
  );
}
