import { formatScore } from "../criteria";
import type { JuryRailItem } from "../types";
import styles from "./HistoryPanel.module.css";

interface HistoryPanelProps {
  rail: readonly JuryRailItem[];
}

function toneClass(verdict: NonNullable<JuryRailItem["ownVerdict"]>): string {
  if (verdict.abstained) return styles.abstain;
  if (verdict.score === null) return styles.neutral;
  if (verdict.score > 3) return styles.back;
  if (verdict.score < 3) return styles.reject;
  return styles.neutral;
}

function formatVerdict(verdict: NonNullable<JuryRailItem["ownVerdict"]>): string {
  if (verdict.abstained) return "Se abstuvo";
  return verdict.score === null ? "Enviado" : `${formatScore(verdict.score)} / 5`;
}

/** Historial de los envíos propios en las rondas terminadas. No se muestra mientras esté vacío. */
export function HistoryPanel({ rail }: HistoryPanelProps) {
  const entries = rail.filter((item) => item.status === "settled" && item.ownVerdict !== null);
  if (entries.length === 0) return null;

  return (
    <section className={styles.card} aria-labelledby="historial-titulo">
      <p id="historial-titulo" className={styles.caption}>
        Tus calificaciones
      </p>
      <ul className={styles.list}>
        {entries.map((item) => {
          const verdict = item.ownVerdict;
          if (verdict === null) return null;
          return (
            <li key={item.number} className={styles.entry}>
              <span>
                R{item.number} · {item.startupName}
              </span>
              <span className={toneClass(verdict)}>{formatVerdict(verdict)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
