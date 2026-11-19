import { describeRoundStatus } from "../messages";
import type { RoundSummary } from "../types";
import styles from "./RoundRail.module.css";

interface RoundRailProps {
  rounds: RoundSummary[];
}

/**
 * Riel de rondas del escritorio: número, startup y estado de cada ronda del evento. La ronda en
 * curso se marca con aria-current para que la lista se lea como secuencia.
 */
export function RoundRail({ rounds }: RoundRailProps) {
  return (
    <section className={styles.rail} aria-labelledby="round-rail-title">
      <h2 id="round-rail-title" className={styles.heading}>
        Rondas
      </h2>
      <ol className={styles.list}>
        {rounds.map((round) => (
          <li
            key={round.number}
            className={`${styles.item} ${styles[round.state]}`}
            aria-current={round.state === "current" ? "step" : undefined}
          >
            <span className={styles.number} aria-hidden="true">
              {round.number}
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{round.startupName}</span>
              <span className={styles.status}>{describeRoundStatus(round)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
