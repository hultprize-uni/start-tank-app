"use client";

import type { Criterion } from "@/shared/domain/types";
import { juryScore } from "@/shared/domain/verdict";
import { Button, Dialog } from "@/shared/ui";
import { formatScore, SCORE_LABELS, type ScoreValue } from "../criteria";
import { useIsDesktop } from "../hooks/useIsDesktop";
import styles from "./ConfirmSendSheet.module.css";

interface ConfirmSendSheetProps {
  open: boolean;
  startupName: string;
  criteria: readonly Criterion[];
  scores: Readonly<Record<string, ScoreValue>>;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Hoja de confirmación del envío único de notas (RF-16, RF-17): resume las notas elegidas y el
 * puntaje ponderado antes de registrar el veredicto definitivo del jurado.
 */
export function ConfirmSendSheet({
  open,
  startupName,
  criteria,
  scores,
  submitting,
  onClose,
  onConfirm,
}: ConfirmSendSheetProps) {
  const isDesktop = useIsDesktop();
  const ratedNotes = criteria.flatMap((criterion) => {
    const value = scores[criterion.id];
    return value === undefined ? [] : [{ value, weight: criterion.weight }];
  });
  const totalScore = ratedNotes.length > 0 ? juryScore(ratedNotes) : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="¿Confirmas el envío de tus notas?"
      description={`Evaluación final para ${startupName}`}
      placement={isDesktop ? "center" : "bottom"}
      closeOnBackdrop={!submitting}
    >
      <div className={styles.body}>
        <ul className={styles.list}>
          {criteria.map((criterion) => {
            const value = scores[criterion.id];
            return (
              <li key={criterion.id} className={styles.row}>
                <span className={styles.criterion}>{criterion.name}</span>
                <span className={styles.value}>
                  {value !== undefined ? `${value} / 5 · ${SCORE_LABELS[value]}` : "Sin nota"}
                </span>
              </li>
            );
          })}
        </ul>

        <div className={styles.totalRow}>
          <span className={styles.totalLabel}>Puntaje ponderado</span>
          <strong className={styles.totalScore}>
            {totalScore !== null ? `${formatScore(totalScore)} / 5` : "—"}
          </strong>
        </div>

        <p className={styles.warning}>
          Esta acción es definitiva. No podrás modificar tus notas y nadie las verá hasta el
          veredicto.
        </p>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Volver
          </Button>
          <Button
            loading={submitting}
            loadingLabel="Enviando notas"
            disabled={ratedNotes.length !== criteria.length}
            onClick={onConfirm}
          >
            Confirmar envío
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
