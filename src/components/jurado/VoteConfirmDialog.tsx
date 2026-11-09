import type { Decision } from "@/lib/domain/types";
import { DECISION_LABELS } from "./decisions";
import styles from "./VoteConfirmDialog.module.css";

interface VoteConfirmDialogProps {
  decision: Decision;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Paso de confirmación previo al voto definitivo. */
export function VoteConfirmDialog({
  decision,
  submitting,
  onCancel,
  onConfirm,
}: VoteConfirmDialogProps) {
  const { title, description } = DECISION_LABELS[decision];

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-voto-titulo"
      >
        <p className={styles.eyebrow}>Voto definitivo</p>
        <h2 id="confirmar-voto-titulo" className={styles.title}>
          ¿Confirmas tu voto?
        </h2>
        <p className={styles.summary}>
          Vas a votar: <strong>{title}</strong>. {description}
        </p>
        <p className={styles.warning}>
          Esta acción es definitiva. No podrás cambiar tu voto en esta ronda.
        </p>

        <div className={styles.actions}>
          <button
            className={styles.secondary}
            type="button"
            onClick={onCancel}
            disabled={submitting}
          >
            Volver
          </button>
          <button
            className={styles.primary}
            type="button"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? "Registrando..." : "Confirmar voto"}
          </button>
        </div>
      </div>
    </div>
  );
}
