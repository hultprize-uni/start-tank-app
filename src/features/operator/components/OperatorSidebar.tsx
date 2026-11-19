"use client";

import { BrandLogo, Button } from "@/shared/ui";

import { ROUND_STATUS_LABELS, formatMultiplier } from "../labels";
import type { RoundSummaryView } from "../types";

import styles from "./OperatorConsole.module.css";

interface OperatorSidebarProps {
  rounds: RoundSummaryView[];
  /** Número de la ronda que controla el operador. */
  currentRound: number;
  connectedAttendees: number;
  onLogout: () => void;
}

/** Texto de estado de una ronda en la lista lateral. */
function summaryTextOf(round: RoundSummaryView, currentRound: number): string {
  if (round.status === "CANCELLED") return "Anulada";
  if (round.status === "SETTLED") {
    return round.multiplier === null ? "Liquidada" : formatMultiplier(round.multiplier);
  }
  if (round.number === currentRound) return ROUND_STATUS_LABELS[round.status];
  return "Pendiente";
}

/** Barra lateral con el evento, los asistentes conectados y la lista de rondas. En pantallas estrechas se reduce a una franja superior. */
export function OperatorSidebar({
  rounds,
  currentRound,
  connectedAttendees,
  onLogout,
}: OperatorSidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Evento y rondas">
      <div className={styles.brandRow}>
        <BrandLogo variant="horizontal" className={styles.brandLogo} />
      </div>
      <p className={styles.eventMeta}>Shark Tank Universitario · 26 Nov · Auditorio CTIC</p>
      <p className={styles.connected}>
        <span className={styles.roundsTitle}>Conectados</span>
        <span className="st-num">{connectedAttendees}</span>
      </p>
      <div>
        <h2 className={styles.roundsTitle}>Rondas</h2>
        <ol className={styles.roundList}>
          {rounds.map((round) => (
            <li
              key={round.number}
              className={styles.roundItem}
              aria-current={round.number === currentRound ? "true" : undefined}
            >
              <span className={styles.roundNumber}>{round.number}</span>
              <span className={styles.roundName}>
                <span>{round.startupName}</span>
                <span className={styles.roundSummary}>
                  {summaryTextOf(round, currentRound)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <Button variant="ghost" onClick={onLogout}>
        Salir
      </Button>
    </aside>
  );
}
