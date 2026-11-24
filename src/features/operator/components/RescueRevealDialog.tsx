"use client";

import { useState } from "react";

import { Button, Dialog, Toast } from "@/shared/ui";

import type { JurorView } from "../types";

import { ReasonField } from "./ReasonField";
import styles from "./Admin.module.css";

interface RescueRevealDialogProps {
  jurors: readonly JurorView[];
  onClose: () => void;
  /** Revela con los presentes. Devuelve el mensaje de error o null si salió bien. */
  onConfirm: (reason: string) => Promise<string | null>;
}

/**
 * Revelar con los jurados presentes (RF-18, CU-13): pide confirmación y motivo, y explica con qué
 * notas se calculará el multiplicador. La acción liquida la ronda y no se puede deshacer.
 */
export function RescueRevealDialog({ jurors, onClose, onConfirm }: RescueRevealDialogProps) {
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const present = jurors.filter((juror) => juror.status === "sent" || juror.status === "abstained");
  const missing = jurors.filter((juror) => juror.status === "pending" || juror.status === "drafting");

  async function confirm() {
    setTried(true);
    if (reason.trim() === "") return;
    setSending(true);
    const failure = await onConfirm(reason.trim());
    setSending(false);
    if (failure === null) onClose();
    else setError(failure);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`¿Revelar con ${present.length} de ${jurors.length} jurados?`}
      description={`El multiplicador se calculará con las notas de ${present
        .map((juror) => juror.name)
        .join(", ")}. ${missing.map((juror) => juror.name).join(", ")} quedará como ausente en esta ronda. Esta acción liquida la ronda y no se puede deshacer.`}
    >
      <div className={styles.form}>
        <ReasonField
          value={reason}
          onChange={setReason}
          placeholder={`${missing[0]?.name ?? "El jurado"} sin conexión desde…`}
          showRequired={tried}
        />
        {error !== null ? (
          <Toast tone="negative" role="alert">
            {error}
          </Toast>
        ) : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Seguir esperando
          </Button>
          <Button loading={sending} loadingLabel="Revelando" onClick={() => void confirm()}>
            Revelar con {present.length} jurados
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
