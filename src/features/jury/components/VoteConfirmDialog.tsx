import { Button, Dialog } from "@/shared/ui";
import type { Decision } from "@/shared/domain/types";
import { DECISION_COPY } from "./copy";
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
  const copy = DECISION_COPY[decision];

  return (
    <Dialog
      open
      onClose={onCancel}
      title="¿Confirmas tu voto?"
      lead="Voto definitivo"
    >
      <p className={styles.summary}>
        Vas a votar: <strong>{copy.choice}</strong>. {copy.confirmation}
      </p>
      <p className={styles.warning}>
        Esta acción es definitiva. No podrás cambiar tu voto en esta ronda.
      </p>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Volver
        </Button>
        <Button
          loading={submitting}
          loadingLabel="Registrando voto"
          onClick={onConfirm}
        >
          Confirmar voto
        </Button>
      </div>
    </Dialog>
  );
}
