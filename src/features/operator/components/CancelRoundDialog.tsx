"use client";

import { useState } from "react";

import { Button, Dialog, Toast } from "@/shared/ui";

import { useCancelRoundDialog } from "../hooks/useCancelRoundDialog";
import type { CancelMode } from "../types";

import { ReasonField } from "./ReasonField";
import styles from "./CancelRoundDialog.module.css";
import admin from "./Admin.module.css";

interface CancelRoundDialogProps {
  roundNumber: number;
  startupName: string;
  onClose: () => void;
  /** Anula la ronda. Devuelve el mensaje de error o null si salió bien. */
  onConfirm: (mode: CancelMode, reason: string) => Promise<string | null>;
}

/** Títulos visibles de cada modo de anulación. */
const MODE_TITLES: Record<CancelMode, string> = {
  refund: "Devolver lo invertido",
  settle_1x: "Liquidar a 1.0x",
};

/** Descripciones visibles de cada modo de anulación. */
const MODE_HINTS: Record<CancelMode, string> = {
  refund: "Cada monto regresa íntegro al saldo y la ronda queda Anulada.",
  settle_1x: "Se liquida con multiplicador 1.0x: nadie gana ni pierde.",
};

/**
 * Anulación de ronda en dos pasos (RF-10, CU-14): primero el modo, luego la confirmación con el
 * motivo obligatorio, que queda en el log. Escape y Cancelar cierran sin anular.
 */
export function CancelRoundDialog({
  roundNumber,
  startupName,
  onClose,
  onConfirm,
}: CancelRoundDialogProps) {
  const dialog = useCancelRoundDialog();
  const { mode } = dialog;
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dialog.step === "choose" || mode === null) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={`¿Anular la ronda ${roundNumber}?`}
        description="Los asistentes no pierden ni ganan por esta startup. Elige cómo se resuelve lo invertido."
      >
        <div className={styles.options}>
          {(Object.keys(MODE_TITLES) as CancelMode[]).map((option) => (
            <button
              key={option}
              type="button"
              className={styles.option}
              onClick={() => dialog.choose(option)}
            >
              <span className={styles.optionTitle}>{MODE_TITLES[option]}</span>
              <span className={styles.optionHint}>{MODE_HINTS[option]}</span>
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

  async function confirm(selected: CancelMode) {
    setTried(true);
    if (reason.trim() === "") return;
    setSending(true);
    const failure = await onConfirm(selected, reason.trim());
    setSending(false);
    if (failure === null) onClose();
    else setError(failure);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Confirmar anulación"
      description={`Se anulará la ronda ${roundNumber} (${startupName}) con la opción «${MODE_TITLES[mode]}». No se puede deshacer.`}
    >
      <div className={admin.form}>
        <ReasonField value={reason} onChange={setReason} showRequired={tried} />
        {error !== null ? (
          <Toast tone="negative" role="alert">
            {error}
          </Toast>
        ) : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={dialog.back}>
            Volver
          </Button>
          <Button
            variant="danger"
            loading={sending}
            loadingLabel="Anulando"
            onClick={() => void confirm(mode)}
          >
            Anular ronda
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
