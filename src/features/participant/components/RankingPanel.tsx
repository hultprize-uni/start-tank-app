import { formatCoins } from "../format";
import type { StandingInfo } from "../types";
import { RankingWindow } from "./RankingWindow";
import styles from "./RankingPanel.module.css";

interface RankingPanelProps {
  standing: StandingInfo;
  /** Muestra la variación frente a la ronda anterior. Solo se usa cuando la ronda ya fue liquidada. */
  showDelta: boolean;
}

function describePositionChange(standing: StandingInfo): { text: string; tone: "up" | "down" | "flat" } {
  const delta = standing.previousPosition - standing.position;
  if (delta > 0) return { text: `▲ ${delta}`, tone: "up" };
  if (delta < 0) return { text: `▼ ${Math.abs(delta)}`, tone: "down" };
  return { text: "= igual", tone: "flat" };
}

/** Distancia al primero y al podio, en una frase. */
function describeDistance(standing: StandingInfo): string {
  if (standing.position === 1) return "Vas primero.";
  const first = `A ${formatCoins(standing.distanceToFirst)} coins del primero`;
  return standing.distanceToPodium > 0
    ? `${first} y a ${formatCoins(standing.distanceToPodium)} del podio.`
    : `${first}. Estás en el podio.`;
}

/**
 * Clasificación (RF-23): tu posición, la distancia al primero y al podio, el top 3 y tus vecinos,
 * 2 por arriba y 2 por abajo, con su movimiento respecto de la ronda anterior.
 */
export function RankingPanel({ standing, showDelta }: RankingPanelProps) {
  const change = describePositionChange(standing);
  const inTopThree = standing.position <= 3;

  return (
    <section className={styles.panel} aria-label="Clasificación">
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
      <p className={styles.distance}>{describeDistance(standing)}</p>

      <p className={styles.label}>Podio</p>
      <RankingWindow entries={standing.topThree} label="Podio" />

      {!inTopThree && standing.window.length > 0 ? (
        <>
          <p className={styles.label}>A tu alrededor</p>
          <RankingWindow entries={standing.window} label="Tus vecinos en la clasificación" />
        </>
      ) : null}
    </section>
  );
}
