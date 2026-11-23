"use client";

import { Badge, GradientCard, ProgressBar } from "@/shared/ui";
import { useAnimatedNumber } from "@/shared/lib/use-animated-number";
import { formatCoins, formatMultiplier, formatSignedCoins } from "../format";
import { useRevealDelay } from "../hooks/useRevealDelay";
import type { AnnulmentMode, RoundInfo, StartupInfo, VerdictInfo } from "../types";
import styles from "./ResultScreen.module.css";

interface ResultScreenProps {
  round: RoundInfo;
  startup: StartupInfo;
  verdict: VerdictInfo;
  /** Saldo actual, que ya incluye el retorno de la ronda. */
  balance: number;
}

const ANNULMENT_TEXT: Record<AnnulmentMode, string> = {
  refund: "El conductor anuló la ronda. Tu inversión volvió íntegra a tu saldo.",
  "settle-1x": "El conductor anuló la ronda y la liquidó a 1.0x.",
};

function describeWaiting(round: RoundInfo): string {
  if (round.number >= round.total) return "Esperando el cierre del evento";
  return `Esperando la ronda ${round.number + 1}`;
}

/**
 * Veredicto de la ronda (RF-21, RF-22): aparece 3 segundos después de la liquidación, para que la
 * sala lo vea primero en el escenario. Muestra el puntaje del jurado en porcentaje, el multiplicador
 * y el saldo que cuenta hasta su valor nuevo: en tono positivo si sube y de aviso si baja.
 */
export function ResultScreen({ round, startup, verdict, balance }: ResultScreenProps) {
  const revealed = useRevealDelay(verdict.settledAt);
  const before = balance - verdict.payout + verdict.invested;
  const shown = useAnimatedNumber(revealed ? balance : before, 1200);
  const isAnnulled = verdict.annulment !== null;
  const tone = verdict.gain > 0 ? styles.gainUp : verdict.gain < 0 ? styles.gainDown : styles.gainFlat;

  if (!revealed) {
    return (
      <section className={styles.screen} aria-live="polite">
        <Badge tone="yellow" live>
          Veredicto · Ronda {round.number}
        </Badge>
        <h1 className={styles.name}>{startup.name}</h1>
        <p className={styles.lead}>Mira el escenario: el jurado está revelando su puntaje.</p>
      </section>
    );
  }

  return (
    <section className={styles.screen} aria-live="polite">
      {isAnnulled ? (
        <Badge tone="yellow">Ronda anulada</Badge>
      ) : (
        <Badge tone="cyan">Veredicto · Ronda {round.number}</Badge>
      )}
      <h1 className={styles.name}>{startup.name}</h1>

      {isAnnulled ? (
        <p className={styles.lead}>{ANNULMENT_TEXT[verdict.annulment ?? "refund"]}</p>
      ) : verdict.scorePct !== null && verdict.juryScore !== null ? (
        <div className={styles.score}>
          <div className={styles.row}>
            <span className={styles.muted}>Puntaje del jurado</span>
            <span>
              {verdict.scorePct} % <span className={styles.muted}>({verdict.juryScore.toFixed(2)} de 5)</span>
            </span>
          </div>
          <ProgressBar
            value={verdict.scorePct}
            max={100}
            label="Puntaje del jurado"
            valueText={`${verdict.scorePct} por ciento`}
          />
        </div>
      ) : null}

      <GradientCard glow panelClassName={styles.multiplierPanel}>
        <span className={styles.label}>Multiplicador</span>
        <span className={styles.multiplier}>{formatMultiplier(verdict.multiplier)}</span>
      </GradientCard>

      <div className={styles.balanceBlock}>
        <span className={styles.label}>Tu saldo</span>
        <span className={`${styles.balance} ${tone}`}>{formatCoins(shown)}</span>
      </div>

      <dl className={styles.summary}>
        <div className={styles.row}>
          <dt className={styles.muted}>Invertiste</dt>
          <dd>{formatCoins(verdict.invested)}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.muted}>Recibes</dt>
          <dd>{formatCoins(verdict.payout)}</dd>
        </div>
        <div className={`${styles.row} ${styles.total}`}>
          <dt>Ganancia de la ronda</dt>
          <dd className={tone}>{formatSignedCoins(verdict.gain)}</dd>
        </div>
      </dl>

      <p className={styles.waiting}>{describeWaiting(round)}</p>
    </section>
  );
}
