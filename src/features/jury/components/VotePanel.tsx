import { SegmentedChoice, Toast, Button } from "@/shared/ui";
import type { Decision } from "@/shared/domain/types";
import type { JuryActions, JuryVoteView } from "../types";
import { DECISION_COPY, DECISION_ORDER } from "./copy";
import { VoteConfirmDialog } from "./VoteConfirmDialog";
import styles from "./VotePanel.module.css";

/** Valor del grupo cuando ninguna decisión está elegida. No corresponde a ninguna opción. */
const NO_CHOICE = "";

interface VotePanelProps {
  startupName: string;
  vote: JuryVoteView;
  actions: JuryActions;
}

/** Ronda en votación: elección de la decisión y confirmación del voto definitivo. */
export function VotePanel({ startupName, vote, actions }: VotePanelProps) {
  const hasDraft = vote.draft !== null;

  return (
    <section className={styles.panel} aria-labelledby="votar-titulo">
      <h2 id="votar-titulo" className={styles.title}>
        ¿Respaldas a {startupName}?
      </h2>

      <SegmentedChoice<Decision | typeof NO_CHOICE>
        label="Decisión de voto"
        value={vote.draft ?? NO_CHOICE}
        disabled={vote.submitting}
        className={styles.choices}
        options={DECISION_ORDER.map((decision) => ({
          value: decision,
          label: (
            <span className={styles.option}>
              <span className={styles.optionTitle}>{DECISION_COPY[decision].choice}</span>
              <span className={styles.optionText}>{DECISION_COPY[decision].description}</span>
            </span>
          ),
        }))}
        onChange={(value) => {
          if (value !== NO_CHOICE) actions.selectDecision(value);
        }}
      />

      <p className={styles.note}>El voto es definitivo. Solo puedes votar una vez por ronda.</p>

      <Button
        size="lg"
        fullWidth
        disabled={!hasDraft || vote.submitting}
        onClick={actions.requestConfirm}
      >
        Confirmar voto
      </Button>

      {vote.errorMessage !== null && (
        <Toast tone="negative" role="alert">
          {vote.errorMessage}
        </Toast>
      )}

      {vote.confirming && vote.draft !== null && (
        <VoteConfirmDialog
          decision={vote.draft}
          submitting={vote.submitting}
          onCancel={actions.cancelConfirm}
          onConfirm={actions.confirmVote}
        />
      )}
    </section>
  );
}
