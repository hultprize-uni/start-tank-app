"use client";

import { useId } from "react";
import type { Criterion } from "@/shared/domain/types";
import { juryScore } from "@/shared/domain/verdict";
import { Button } from "@/shared/ui";
import { formatScore, type ScoreValue } from "../criteria";
import type { DraftStatus } from "../hooks/useDraft";
import styles from "./ScoreSummary.module.css";

interface ScoreSummaryProps {
  criteria: readonly Criterion[];
  scores: Readonly<Record<string, ScoreValue>>;
  canSubmit: boolean;
  submitting: boolean;
  draftStatus: DraftStatus;
  hasRecoveredDraft: boolean;
  onRequestSend: () => void;
}

function draftStatusText(
  draftStatus: DraftStatus,
  hasRecoveredDraft: boolean,
  ratedCount: number,
): string {
  if (draftStatus === "saving") return "Guardando borrador…";
  if (draftStatus === "error") return "No se pudo guardar el borrador";
  if (draftStatus === "saved" || (hasRecoveredDraft && ratedCount > 0)) {
    return "Borrador guardado";
  }
  return "Califica del 1 al 5";
}

function submitHintText(canSubmit: boolean, totalCount: number, ratedCount: number): string {
  if (!canSubmit) return "Se habilita cuando el operador abra la votación.";
  const remaining = Math.max(0, totalCount - ratedCount);
  if (remaining === 1) return "Califica 1 criterio restante para enviar.";
  if (remaining > 1) return `Califica los ${remaining} criterios restantes para enviar.`;
  return "Envío único y definitivo.";
}

/**
 * Resumen fijo al fondo durante la calificación (RF-14, RF-16): muestra el puntaje promedio
 * ponderado en vivo, el estado del borrador guardado y el botón Enviar notas bloqueado hasta que
 * el operador habilite la votación y estén los cuatro criterios calificados.
 */
export function ScoreSummary({
  criteria,
  scores,
  canSubmit,
  submitting,
  draftStatus,
  hasRecoveredDraft,
  onRequestSend,
}: ScoreSummaryProps) {
  const hintId = useId();
  const ratedNotes = criteria.flatMap((criterion) => {
    const value = scores[criterion.id];
    return value === undefined ? [] : [{ value, weight: criterion.weight }];
  });

  const ratedCount = ratedNotes.length;
  const totalCount = criteria.length;
  const allRated = totalCount > 0 && ratedCount === totalCount;
  const liveScore = ratedCount > 0 ? juryScore(ratedNotes) : null;
  const draftLabel = draftStatusText(draftStatus, hasRecoveredDraft, ratedCount);
  const hint = submitHintText(canSubmit, totalCount, ratedCount);
  const canSend = canSubmit && allRated && !submitting;

  const draftToneClass =
    draftStatus === "error"
      ? styles.draftError
      : draftStatus === "saved" || (hasRecoveredDraft && ratedCount > 0)
        ? styles.draftSaved
        : styles.draftMuted;

  return (
    <div className={styles.bar} aria-label="Resumen de calificación">
      <div className={styles.metrics}>
        <div className={styles.scoreBlock}>
          <span className={styles.caption}>Puntaje en vivo</span>
          <p className={styles.score}>
            {liveScore !== null ? formatScore(liveScore) : "—"}
            <span className={styles.scale}> / 5</span>
          </p>
        </div>

        <div className={styles.meta}>
          <span className={styles.progress}>
            {ratedCount} de {totalCount} criterios
          </span>
          <span role="status" className={`${styles.draft} ${draftToneClass}`}>
            {draftLabel}
          </span>
        </div>
      </div>

      <div className={styles.actionBlock}>
        <Button
          size="lg"
          fullWidth
          disabled={!canSend}
          loading={submitting}
          loadingLabel="Enviando notas"
          aria-describedby={hintId}
          onClick={onRequestSend}
        >
          Enviar notas
        </Button>
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      </div>
    </div>
  );
}
