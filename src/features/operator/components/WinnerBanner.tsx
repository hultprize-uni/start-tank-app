import { EVENT_CONFIG } from "@/shared/domain/config";

import { formatScore } from "../labels";

import styles from "./OperatorConsole.module.css";

interface WinnerBannerProps {
  name: string;
  score: number;
}

/** Startup con mayor puntaje tras liquidar la última ronda del evento. */
export function WinnerBanner({ name, score }: WinnerBannerProps) {
  const juryPct = Math.round(EVENT_CONFIG.winnerWeightJury * 100);
  const tractionPct = Math.round(EVENT_CONFIG.winnerWeightTraction * 100);

  return (
    <section className={styles.winner} aria-labelledby="startup-ganadora">
      <p className={styles.winnerLabel}>Startup ganadora</p>
      <h2 id="startup-ganadora" className={styles.winnerName}>
        {name}
      </h2>
      <p className={styles.winnerScore}>
        Puntaje {formatScore(score)} · {juryPct}% jurado + {tractionPct}% tracción
      </p>
    </section>
  );
}
