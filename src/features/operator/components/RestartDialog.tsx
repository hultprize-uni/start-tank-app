"use client";

import { useState } from "react";

import { Button, Dialog, Toast } from "@/shared/ui";

import { ReasonField } from "./ReasonField";
import styles from "./CancelRoundDialog.module.css";
import admin from "./Admin.module.css";

interface RestartDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  /** Si se indica, hay que escribir esta palabra para confirmar; si no, se pide un motivo. */
  confirmWord?: string;
  onClose: () => void;
  /** Ejecuta el reinicio con el texto escrito. Devuelve el mensaje de error o null si salió bien. */
  onConfirm: (text: string) => Promise<string | null>;
}

/** Confirmación de un reinicio manual: de ronda (con motivo) o del evento (con palabra clave). */
export function RestartDialog({
  title,
  description,
  confirmLabel,
  confirmWord,
  onClose,
  onConfirm,
}: RestartDialogProps) {
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = confirmWord === undefined ? text.trim() !== "" : text.trim() === confirmWord;

  async function confirm() {
    setTried(true);
    if (!valid) return;
    setSending(true);
    const failure = await onConfirm(text.trim());
    setSending(false);
    if (failure === null) onClose();
    else setError(failure);
  }

  return (
    <Dialog open onClose={onClose} title={title} description={description}>
      <div className={admin.form}>
        <ReasonField
          value={text}
          onChange={setText}
          label={confirmWord === undefined ? undefined : `Escribe ${confirmWord} para confirmar`}
          placeholder={confirmWord}
          showRequired={tried && !valid}
        />
        {error !== null ? (
          <Toast tone="negative" role="alert">
            {error}
          </Toast>
        ) : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={sending}
            loadingLabel="Reiniciando"
            disabled={tried && !valid}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
