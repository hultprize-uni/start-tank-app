import type { StandingEntry, StandingInfo } from "@/lib/api/investor.types";
import { formatCoins } from "./format";
import styles from "./Leaderboard.module.css";

interface LeaderboardProps {
  standing: StandingInfo;
}

/** Fila de la clasificación: posición, nombre y saldo. */
function LeaderboardRow({ entry }: { entry: StandingEntry }) {
  const rowClass = entry.isCurrent ? `${styles.row} ${styles.current}` : styles.row;
  return (
    <li className={rowClass}>
      <span className={styles.position}>#{entry.position}</span>
      <span className={styles.name}>{entry.name}</span>
      <span className={styles.balance}>{formatCoins(entry.balance)}</span>
    </li>
  );
}

/** Clasificación parcial: top 3 del evento y la fila del inversionista si queda fuera del top. */
export function Leaderboard({ standing }: LeaderboardProps) {
  const isOutsideTop = !standing.topThree.some((entry) => entry.isCurrent);

  return (
    <section className={styles.board} aria-label="Clasificación parcial">
      <h3 className={styles.heading}>Top 3 del evento</h3>
      <ol className={styles.list}>
        {standing.topThree.map((entry) => (
          <LeaderboardRow key={entry.position} entry={entry} />
        ))}
      </ol>
      {isOutsideTop && (
        <>
          <p className={styles.gap} aria-hidden="true">
            ···
          </p>
          <ol className={styles.list}>
            <LeaderboardRow entry={standing.me} />
          </ol>
        </>
      )}
    </section>
  );
}
