import type { Criterion } from "@/shared/domain/types";
import { juryFraction } from "@/shared/domain/verdict";
import { Eyebrow, GradientCard } from "@/shared/ui";
import { formatMultiplier, formatScore } from "../criteria";
import type { JuryRevealJuror, JuryRevealView } from "../types";
import styles from "./ResultPanel.module.css";

interface ResultPanelProps {
  reveal: JuryRevealView;
  criteria: readonly Criterion[];
}

function scoreToneClass(juror: JuryRevealJuror): string {
  if (!juror.submitted) return styles.none;
  if (juror.abstained) return styles.abstain;
  if (juror.score === null) return styles.none;
  if (juror.score > 3) return styles.back;
  if (juror.score < 3) return styles.reject;
  return styles.neutral;
}

function scoreSummaryText(juror: JuryRevealJuror): string {
  if (!juror.submitted) return "Sin envío";
  if (juror.abstained) return "Se abstuvo";
  return juror.score === null ? "Sin puntaje" : `${formatScore(juror.score)} / 5`;
}

/** Veredicto de la ronda liquidada: puntaje de la startup, multiplicador y notas de los 4 jurados. */
export function ResultPanel({ reveal, criteria }: ResultPanelProps) {
  const multiplier = reveal.multiplier === null ? "—" : formatMultiplier(reveal.multiplier);
  const startupScore =
    reveal.startupScore === null ? "—" : `${formatScore(reveal.startupScore)} / 5`;
  const scorePct =
    reveal.startupScore === null ? null : `${Math.round(juryFraction(reveal.startupScore) * 100)}%`;
  const nextText = reveal.isLastRound
    ? "Última ronda. El operador cerrará el evento."
    : "El operador pasará a la siguiente startup.";

  return (
    <GradientCard as="section" panelClassName={styles.panel}>
      <div className={styles.hero}>
        <div>
          <Eyebrow tone="muted">Veredicto · multiplicador</Eyebrow>
          <p className={styles.multiplier}>{multiplier}</p>
        </div>
        <div className={styles.scoreSummary}>
          <Eyebrow tone="muted">Puntaje del jurado</Eyebrow>
          <p className={styles.startupScore}>{startupScore}</p>
          {scorePct !== null && <p className={styles.scorePct}>{scorePct} de la escala</p>}
        </div>
      </div>

      <ul className={styles.votes}>
        {reveal.jurors.map((juror) => (
          <li key={juror.label} className={styles.vote}>
            <div className={styles.voteTop}>
              <span className={styles.jurorLabel}>
                {juror.label}
                {juror.isOwn ? " (tú)" : ""}
              </span>
              <span className={scoreToneClass(juror)}>{scoreSummaryText(juror)}</span>
            </div>

            {juror.submitted &&
              !juror.abstained &&
              criteria.length > 0 &&
              Object.keys(juror.notes).length > 0 && (
              <ul className={styles.criteriaNotes} aria-label={`Notas de ${juror.label}`}>
                {criteria.map((criterion) => {
                  const note = juror.notes[criterion.id];
                  return (
                    <li key={criterion.id} className={styles.criterionNote}>
                      <span className={styles.criterionName}>{criterion.name}</span>
                      <strong className={styles.criterionValue}>
                        {note !== undefined ? note : "—"}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <p className={styles.next}>{nextText}</p>
    </GradientCard>
  );
}
