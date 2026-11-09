import type { Decision } from "@/lib/domain/types";
import type {
  JuryCriterion,
  JuryRoundView,
  JuryVoteView,
} from "@/lib/api/jury.types";
import { CriteriaReminder } from "./CriteriaReminder";
import { VoteConfirmDialog } from "./VoteConfirmDialog";
import { DECISION_LABELS, DECISION_ORDER } from "./decisions";
import styles from "./VotePanel.module.css";

interface VotePanelProps {
  round: JuryRoundView;
  criteria: readonly JuryCriterion[];
  vote: JuryVoteView;
  onSelect: (decision: Decision) => void;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirm: () => void;
}

/** Ronda en votación: elección de la decisión y confirmación del voto definitivo. */
export function VotePanel({
  round,
  criteria,
  vote,
  onSelect,
  onRequestConfirm,
  onCancelConfirm,
  onConfirm,
}: VotePanelProps) {
  const hasDraft = vote.draft !== null;

  return (
    <section className={styles.panel} aria-labelledby="votar-titulo">
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Ronda {round.number} · En votación</p>
          <h1 id="votar-titulo" className={styles.title}>
            {round.startupName}
          </h1>
        </div>
        <CriteriaReminder criteria={criteria} />
      </header>

      <div className={styles.options} role="group" aria-label="Decisión">
        {DECISION_ORDER.map((decision) => {
          const { title, hint } = DECISION_LABELS[decision];
          const selected = vote.draft === decision;
          const className = [
            styles.option,
            decision === "SE_ABSTIENE" ? styles.optionAbstain : "",
            selected ? styles.optionSelected : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={decision}
              type="button"
              className={className}
              aria-pressed={selected}
              disabled={vote.submitting}
              onClick={() => onSelect(decision)}
            >
              <span className={styles.optionTitle}>{title}</span>
              {hint !== null && (
                <span className={styles.optionHint}>{hint}</span>
              )}
            </button>
          );
        })}
      </div>

      <footer className={styles.footer}>
        <p className={styles.note}>
          Tu voto es definitivo. Solo puedes votar una vez por ronda.
        </p>
        <button
          type="button"
          className={styles.confirm}
          disabled={!hasDraft || vote.submitting}
          onClick={onRequestConfirm}
        >
          Confirmar voto
        </button>
      </footer>

      {vote.errorMessage !== null && (
        <p className={styles.error} role="alert">
          {vote.errorMessage}
        </p>
      )}

      {vote.confirming && vote.draft !== null && (
        <VoteConfirmDialog
          decision={vote.draft}
          submitting={vote.submitting}
          onCancel={onCancelConfirm}
          onConfirm={onConfirm}
        />
      )}
    </section>
  );
}
