import { Eyebrow, GradientCard } from "@/shared/ui";
import type { Decision } from "@/shared/domain/types";
import type { JuryRevealView } from "../types";
import { DECISION_COPY } from "./copy";
import styles from "./ResultPanel.module.css";

interface ResultPanelProps {
  reveal: JuryRevealView;
}

/** Clase de color de la decisión publicada. */
const TONE_CLASS: Readonly<Record<Decision, string>> = {
  BACK: styles.back,
  REJECT: styles.reject,
  ABSTAIN: styles.abstain,
};

/** Veredicto de la ronda liquidada: multiplicador y votos de los cuatro jurados. */
export function ResultPanel({ reveal }: ResultPanelProps) {
  const multiplier = reveal.multiplier === null ? "-" : `${reveal.multiplier.toFixed(1)}x`;
  const nextText = reveal.isLastRound
    ? "Última ronda. El operador cerrará el evento."
    : "El operador pasará a la siguiente startup.";

  return (
    <GradientCard as="section" panelClassName={styles.panel}>
      <Eyebrow tone="muted">Veredicto · multiplicador</Eyebrow>
      <p className={styles.multiplier}>{multiplier}</p>

      <ul className={styles.votes}>
        {reveal.votes.map((vote) => (
          <li key={vote.label} className={styles.vote}>
            <span>
              {vote.label}
              {vote.isOwn ? " (tú)" : ""}
            </span>
            <span className={vote.decision === null ? styles.none : TONE_CLASS[vote.decision]}>
              {vote.decision === null ? "Sin voto" : DECISION_COPY[vote.decision].record}
            </span>
          </li>
        ))}
      </ul>

      <p className={styles.next}>{nextText}</p>
    </GradientCard>
  );
}
