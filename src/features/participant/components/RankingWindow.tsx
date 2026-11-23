import { formatCoins } from "../format";
import type { StandingEntry } from "../types";
import styles from "./RankingPanel.module.css";

/** Flecha de movimiento frente a la ronda anterior. */
function movementOf(entry: StandingEntry): { symbol: string; label: string; tone: "up" | "down" | "flat" } {
  if (entry.previousPosition === null) return { symbol: "•", label: "nuevo", tone: "flat" };
  const delta = entry.previousPosition - entry.position;
  if (delta > 0) return { symbol: "▲", label: `sube ${delta}`, tone: "up" };
  if (delta < 0) return { symbol: "▼", label: `baja ${Math.abs(delta)}`, tone: "down" };
  return { symbol: "=", label: "igual", tone: "flat" };
}

/** Filas de la clasificación con flecha de movimiento y la fila propia resaltada. */
export function RankingWindow({ entries, label }: { entries: readonly StandingEntry[]; label: string }) {
  return (
    <ol className={styles.list} aria-label={label}>
      {entries.map((entry) => {
        const movement = movementOf(entry);
        return (
          <li
            key={`${entry.position}-${entry.name}`}
            className={entry.isCurrent ? `${styles.row} ${styles.current}` : styles.row}
            aria-current={entry.isCurrent ? "true" : undefined}
          >
            <span className={styles.who}>
              <span className={`${styles.move} ${styles[movement.tone]}`} aria-label={movement.label}>
                {movement.symbol}
              </span>
              {entry.position}. {entry.name}
            </span>
            <span className={styles.balance}>{formatCoins(entry.balance)}</span>
          </li>
        );
      })}
    </ol>
  );
}
