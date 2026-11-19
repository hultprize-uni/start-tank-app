import { formatSignedCoins } from "../format";
import type { RoundSummary } from "../types";
import styles from "./RoundHistory.module.css";

interface RoundHistoryProps {
  rounds: RoundSummary[];
}

/** Texto del resultado de una ronda invertida: anulada, o ganancia o pérdida neta. */
function describeResult(round: RoundSummary): { text: string; tone: string } {
  if (round.state === "annulled") return { text: "Anulada", tone: styles.neutral };
  const gain = round.gain ?? 0;
  const tone = gain > 0 ? styles.up : gain < 0 ? styles.down : styles.neutral;
  return { text: formatSignedCoins(gain), tone };
}

/**
 * Historial del asistente: una fila por ronda liquidada o anulada en la que invirtió. No se muestra
 * si todavía no hay rondas con inversión terminada.
 */
export function RoundHistory({ rounds }: RoundHistoryProps) {
  const entries = rounds.filter(
    (round) => round.invested > 0 && (round.state === "settled" || round.state === "annulled"),
  );
  if (entries.length === 0) return null;

  return (
    <section className={styles.panel} aria-label="Tus rondas">
      <p className={styles.heading}>Tus rondas</p>
      <ul className={styles.list}>
        {entries.map((round) => {
          const result = describeResult(round);
          return (
            <li key={round.number} className={styles.row}>
              <span>
                R{round.number} · {round.startupName}
              </span>
              <span className={result.tone}>{result.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
