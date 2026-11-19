"use client";

import { Button, Dialog } from "@/shared/ui";

import { useCancelRoundDialog } from "../hooks/useCancelRoundDialog";
import type { CancelMode } from "../types";

import styles from "./CancelRoundDialog.module.css";

interface CancelRoundDialogProps {
  roundNumber: number;
  startupName: string;
  onClose: () => void;
  onConfirm: (mode: CancelMode) => void;
}

/** Títulos visibles de cada modo de anulación. */
const MODE_TITLES: Record<CancelMode, string> = {
  refund: "Devolver lo invertido",
  settle_1x: "Liquidar a 1.0x",
};

/** Descripciones visibles de cada modo de anulación. */
const MODE_HINTS: Record<CancelMode, string> = {
  refund: "Cada monto regresa íntegro al saldo.",
  settle_1x: "Se registra como liquidación neutra.",
};

/**
 * Diálogo de anulación en dos pasos. El primer paso elige el modo; el segundo pide confirmación
 * antes de anular. Escape y el botón Cancelar cierran el diálogo sin anular.
 */
export function CancelRoundDialog({
  roundNumber,
  startupName,
  onClose,
  onConfirm,
}: CancelRoundDialogProps) {
  const dialog = useCancelRoundDialog();
  const { mode } = dialog;

  if (dialog.step === "choose" || mode === null) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={`¿Anular la ronda ${roundNumber}?`}
        description="Los asistentes no pierden ni ganan por esta startup. Elige cómo se resuelve lo invertido."
      >
        <div className={styles.options}>
          {(Object.keys(MODE_TITLES) as CancelMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={styles.option}
              onClick={() => dialog.choose(mode)}
            >
              <span className={styles.optionTitle}>{MODE_TITLES[mode]}</span>
              <span className={styles.optionHint}>{MODE_HINTS[mode]}</span>
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Confirmar anulación"
      description={`Se anulará la ronda ${roundNumber} (${startupName}) con la opción «${MODE_TITLES[mode]}». Esta acción queda en el registro.`}
    >
      <div className={styles.actions}>
        <Button variant="ghost" onClick={dialog.back}>
          Volver
        </Button>
        <Button variant="danger" onClick={() => onConfirm(mode)}>
          Anular ronda
        </Button>
      </div>
    </Dialog>
  );
}
