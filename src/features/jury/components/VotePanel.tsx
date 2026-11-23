"use client";

import type { Criterion } from "@/shared/domain/types";
import { Button, Toast } from "@/shared/ui";
import type {
  CriteriaScores,
  DraftSaveStatus,
  JuryActions,
  JuryPhase,
  JuryVoteUiState,
} from "../types";
import { AbstainSheet } from "./AbstainSheet";
import { ConfirmSendSheet } from "./ConfirmSendSheet";
import { CriteriaCard } from "./CriteriaCard";
import { ScoreSummary } from "./ScoreSummary";
import styles from "./VotePanel.module.css";

interface VotePanelProps {
  startupName: string;
  phase: JuryPhase;
  criteria: readonly Criterion[];
  draftNotes: CriteriaScores;
  draftStatus: DraftSaveStatus;
  draftError: string | null;
  vote: JuryVoteUiState;
  actions: JuryActions;
}

/**
 * Panel de calificación por criterios (RF-14 a RF-16): permite guardar notas en borrador desde
 * que abre el mercado y habilita el envío definitivo o la abstención durante la votación.
 */
export function VotePanel({
  startupName,
  phase,
  criteria,
  draftNotes,
  draftStatus,
  draftError,
  vote,
  actions,
}: VotePanelProps) {
  const canSubmit = phase === "voting";
  const errorMessage = vote.errorMessage ?? draftError;
  const hasRecoveredDraft = Object.keys(draftNotes).length > 0;

  return (
    <section className={styles.panel} aria-labelledby="calificar-titulo">
      <div className={styles.intro}>
        <h2 id="calificar-titulo" className={styles.title}>
          Califica a {startupName}
        </h2>
        <p className={styles.lead}>
          {canSubmit
            ? "La votación está abierta. Revisa tus cuatro notas y envíalas o declara conflicto de interés."
            : "Califica mientras expone. Cada nota se guarda en borrador automáticamente."}
        </p>
      </div>

      <div className={styles.grid}>
        {criteria.map((criterion, index) => (
          <CriteriaCard
            key={criterion.id}
            index={index}
            criterion={criterion}
            value={draftNotes[criterion.id] ?? null}
            disabled={vote.submitting}
            onChange={(value) => actions.setScore(criterion.id, value)}
          />
        ))}
      </div>

      <div className={styles.abstainRow}>
        <Button
          variant="ghost"
          size="md"
          disabled={!canSubmit || vote.submitting}
          onClick={actions.openAbstain}
        >
          Declarar conflicto de interés
        </Button>
        {!canSubmit && (
          <span className={styles.abstainHint}>
            Disponible cuando el operador habilite la votación.
          </span>
        )}
      </div>

      {errorMessage !== null && (
        <Toast tone="negative" role="alert">
          {errorMessage}
        </Toast>
      )}

      <ScoreSummary
        criteria={criteria}
        scores={draftNotes}
        canSubmit={canSubmit}
        submitting={vote.submitting}
        draftStatus={draftStatus}
        hasRecoveredDraft={hasRecoveredDraft}
        onRequestSend={actions.openConfirmSend}
      />

      <ConfirmSendSheet
        open={vote.sheet === "confirm_send"}
        startupName={startupName}
        criteria={criteria}
        scores={draftNotes}
        submitting={vote.submitting}
        onClose={actions.closeSheet}
        onConfirm={actions.confirmSend}
      />

      <AbstainSheet
        open={vote.sheet === "abstain"}
        startupName={startupName}
        submitting={vote.submitting}
        onClose={actions.closeSheet}
        onConfirm={actions.confirmAbstain}
      />
    </section>
  );
}
