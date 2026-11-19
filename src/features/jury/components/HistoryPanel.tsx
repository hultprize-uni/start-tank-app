import type { Decision } from "@/shared/domain/types";
import type { JuryRailItem } from "../types";
import { DECISION_COPY } from "./copy";
import styles from "./HistoryPanel.module.css";

interface HistoryPanelProps {
  rail: readonly JuryRailItem[];
}

/** Clase de color de la decisión registrada en el historial. */
const TONE_CLASS: Readonly<Record<Decision, string>> = {
  BACK: styles.back,
  REJECT: styles.reject,
  ABSTAIN: styles.abstain,
};

/** Historial de los votos propios en las rondas terminadas. No se muestra mientras esté vacío. */
export function HistoryPanel({ rail }: HistoryPanelProps) {
  const entries = rail.filter((item) => item.status === "settled" && item.ownDecision !== null);
  if (entries.length === 0) return null;

  return (
    <section className={styles.card} aria-labelledby="historial-titulo">
      <p id="historial-titulo" className={styles.caption}>
        Tus votos
      </p>
      <ul className={styles.list}>
        {entries.map((item) => {
          const decision = item.ownDecision;
          if (decision === null) return null;
          return (
            <li key={item.number} className={styles.entry}>
              <span>
                R{item.number} · {item.startupName}
              </span>
              <span className={TONE_CLASS[decision]}>{DECISION_COPY[decision].record}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
