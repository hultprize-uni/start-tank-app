"use client";

import { useState } from "react";

import { Button, Dialog, Toast } from "@/shared/ui";

import { formatCoins, formatSignedCoins } from "../labels";
import type { AttendeeView } from "../types";

import { ReasonField } from "./ReasonField";
import styles from "./Admin.module.css";

interface BalanceAdjustDialogProps {
  attendee: AttendeeView;
  onClose: () => void;
  /** Ajusta el saldo. Devuelve el mensaje de error o null si salió bien. */
  onConfirm: (amount: number, reason: string) => Promise<string | null>;
}

/**
 * Ajuste manual de saldo (RF-11, CU-15). El monto puede ser positivo o negativo; el motivo es
 * obligatorio y queda en el log. Muestra el saldo resultante antes de confirmar.
 */
export function BalanceAdjustDialog({ attendee, onClose, onConfirm }: BalanceAdjustDialogProps) {
  const [direction, setDirection] = useState<"add" | "subtract">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const magnitude = Number(amount);
  const validAmount = Number.isFinite(magnitude) && magnitude > 0;
  const signed = direction === "add" ? magnitude : -magnitude;
  const resulting = attendee.balance + (validAmount ? signed : 0);
  const negative = resulting < 0;

  async function confirm() {
    setTried(true);
    if (!validAmount || negative || reason.trim() === "") return;
    setSending(true);
    const failure = await onConfirm(signed, reason.trim());
    setSending(false);
    if (failure === null) onClose();
    else setError(failure);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Ajustar el saldo de ${attendee.name}`}
      description={`Saldo actual: ${formatCoins(attendee.balance)} IC. El ajuste queda en el log con tu nombre y el motivo.`}
    >
      <div className={styles.form}>
        <div className={styles.choiceGrid} role="group" aria-label="Tipo de ajuste">
          <button
            type="button"
            className={styles.choice}
            aria-pressed={direction === "add"}
            onClick={() => setDirection("add")}
          >
            <span className={styles.choiceTitle}>Sumar</span>
          </button>
          <button
            type="button"
            className={styles.choice}
            aria-pressed={direction === "subtract"}
            onClick={() => setDirection("subtract")}
          >
            <span className={styles.choiceTitle}>Restar</span>
          </button>
        </div>
        <div className={styles.field}>
          <label htmlFor="monto-ajuste" className={styles.label}>
            Monto (IC)
          </label>
          <input
            id="monto-ajuste"
            className={styles.input}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={amount}
            aria-invalid={tried && (!validAmount || negative)}
            onChange={(event) => setAmount(event.target.value)}
          />
          {tried && !validAmount ? (
            <p className={styles.error}>Escribe un monto mayor que 0.</p>
          ) : negative ? (
            <p className={styles.error}>El saldo no puede quedar por debajo de 0.</p>
          ) : (
            <p className={styles.hint}>
              Saldo resultante: {formatCoins(resulting)} IC
              {validAmount ? ` (${formatSignedCoins(signed)})` : ""}
            </p>
          )}
        </div>
        <ReasonField
          value={reason}
          onChange={setReason}
          placeholder="Error del sistema al registrar su inversión…"
          showRequired={tried}
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
          <Button loading={sending} loadingLabel="Ajustando" onClick={() => void confirm()}>
            Confirmar ajuste
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
