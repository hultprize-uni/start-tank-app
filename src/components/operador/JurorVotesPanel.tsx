import type { JurorSense, JurorVoteView } from "@/lib/api/operator.types";

import styles from "./OperatorConsole.module.css";

interface JurorVotesPanelProps {
  jurors: JurorVoteView[];
  canSimulateVote: boolean;
  onSimulateVote: (jurorId: string) => void;
}

const SENSE_LABELS: Record<JurorSense, string> = {
  respalda: "Respalda",
  rechaza: "Rechaza",
  abstiene: "Se abstiene",
};

/**
 * Votos del jurado. Antes de revelar solo se muestra si el voto fue emitido;
 * el sentido aparece al revelar o liquidar la ronda.
 */
export function JurorVotesPanel({
  jurors,
  canSimulateVote,
  onSimulateVote,
}: JurorVotesPanelProps) {
  const emittedCount = jurors.filter((juror) => juror.emitted).length;

  return (
    <section className={styles.panel} aria-labelledby="votos-jurado">
      <div className={styles.panelHeader}>
        <h3 id="votos-jurado" className={styles.panelTitle}>
          Votos
        </h3>
        <span className={styles.muted}>
          {emittedCount} de {jurors.length} emitidos
        </span>
      </div>
      <div className={styles.jurorGrid}>
        {jurors.map((juror) => (
          <article key={juror.id} className={styles.jurorCard}>
            <span className={styles.jurorName}>{juror.label}</span>
            {juror.sense !== null ? (
              <span className={styles.jurorSense}>
                {SENSE_LABELS[juror.sense]}
              </span>
            ) : (
              <span
                className={
                  juror.emitted
                    ? `${styles.jurorStatus} ${styles.jurorStatusEmitted}`
                    : `${styles.jurorStatus} ${styles.jurorStatusMissing}`
                }
              >
                {juror.emitted ? "Emitido" : "Falta"}
              </span>
            )}
            {canSimulateVote && !juror.emitted ? (
              <button
                type="button"
                className={`${styles.button} ${styles.buttonSmall}`}
                onClick={() => onSimulateVote(juror.id)}
              >
                Simular voto
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
