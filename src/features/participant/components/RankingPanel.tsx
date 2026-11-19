import { formatCoins } from "../format";
import type { StandingInfo } from "../types";
import styles from "./RankingPanel.module.css";

interface RankingPanelProps {
  standing: StandingInfo;
  /** Muestra la variación frente a la ronda anterior. Solo se usa cuando la ronda ya fue liquidada. */
  showDelta: boolean;
}

/** Variación de la posición: texto con flecha y tono de color. */
function describePositionChange(standing: StandingInfo): { text: string; tone: "up" | "down" | "flat" } {
  const delta = standing.previousPosition - standing.position;
  if (delta > 0) return { text: `▲ ${delta}`, tone: "up" };
  if (delta < 0) return { text: `▼ ${Math.abs(delta)}`, tone: "down" };
  return { text: "= igual", tone: "flat" };
}

/** Clasificación parcial: posición del asistente y las tres primeras posiciones del evento. */
export function RankingPanel({ standing, showDelta }: RankingPanelProps) {
  const change = describePositionChange(standing);

  return (
    <section className={styles.panel} aria-label="Clasificación parcial">
      <div className={styles.position}>
        <div>
          <p className={styles.label}>Tu posición</p>
          <p className={styles.value}>
            #{standing.position} <span className={styles.of}>de {standing.participants}</span>
          </p>
        </div>
        {showDelta ? (
          <span className={`${styles.delta} ${styles[change.tone]}`}>{change.text}</span>
        ) : null}
      </div>

      <p className={styles.label}>Top 3</p>
      <ol className={styles.list}>
        {standing.topThree.map((entry) => (
          <li
            key={entry.position}
            className={entry.isCurrent ? `${styles.row} ${styles.current}` : styles.row}
          >
            <span>
              {entry.position} · {entry.name}
            </span>
            <span className={styles.balance}>{formatCoins(entry.balance)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
