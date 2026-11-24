"use client";

import { useState } from "react";

import { Button, Dialog, Toast, type ToastTone } from "@/shared/ui";

import { formatMultiplier } from "../labels";
import { multiplierForScore } from "@/shared/domain/verdict";

import { ReasonField } from "./ReasonField";
import panel from "./Panel.module.css";
import styles from "./Admin.module.css";

interface Feedback {
  tone: ToastTone;
  role: "status" | "alert";
  message: string;
}

interface ManualSettlementPanelProps {
  /** La ronda está cerrada o en votación. */
  available: boolean;
  /** Liquida a mano. Devuelve el multiplicador o el mensaje de error. */
  onSettle: (score: number, reason: string) => Promise<{ multiplier: number } | { error: string }>;
}

/** Paso del puntaje manual: cuartos de punto, como el promedio de cuatro jurados. */
const SCORE_STEP = 0.25;

/**
 * Liquidación manual (tarea 5.6, RNF-08): si el voto digital falla, el conductor escribe el
 * puntaje de la startup contado a mano (1 a 5) y un motivo. Confirma en un diálogo porque la
 * ronda queda liquidada y no se puede deshacer.
 */
export function ManualSettlementPanel({ available, onSettle }: ManualSettlementPanelProps) {
  const [score, setScore] = useState("3");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!available) {
    return null;
  }

  const value = Number(score);
  const valid = Number.isFinite(value) && value >= 1 && value <= 5;

  function review() {
    setTried(true);
    if (valid && reason.trim() !== "") setConfirming(true);
  }

  async function confirm() {
    setSubmitting(true);
    const result = await onSettle(value, reason.trim());
    setSubmitting(false);
    setConfirming(false);
    if ("multiplier" in result) {
      setFeedback({
        tone: "positive",
        role: "status",
        message: `Ronda liquidada a mano con ${formatMultiplier(result.multiplier)}.`,
      });
      setReason("");
      setTried(false);
    } else {
      setFeedback({ tone: "negative", role: "alert", message: result.error });
    }
  }

  return (
    <div className={panel.controlItem}>
      <h3 className={panel.title}>Liquidación manual</h3>
      <p className={panel.note}>Si falla el voto digital, liquida con el puntaje contado a mano.</p>
      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="puntaje-manual" className={styles.label}>
            Puntaje de la startup (1 a 5)
          </label>
          <input
            id="puntaje-manual"
            className={`${styles.input} ${styles.numberInput}`}
            type="number"
            inputMode="decimal"
            min={1}
            max={5}
            step={SCORE_STEP}
            value={score}
            aria-invalid={tried && !valid}
            onChange={(event) => setScore(event.target.value)}
          />
          <p className={styles.hint}>
            {valid
              ? `Multiplicador resultante: ${formatMultiplier(multiplierForScore(value))}`
              : "Escribe un puntaje entre 1 y 5."}
          </p>
        </div>
        <ReasonField value={reason} onChange={setReason} showRequired={tried} />
        <div>
          <Button variant="danger" disabled={submitting} onClick={review}>
            Liquidar a mano…
          </Button>
        </div>
      </div>

      {feedback !== null ? (
        <Toast tone={feedback.tone} role={feedback.role}>
          {feedback.message}
        </Toast>
      ) : null}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirmar liquidación manual"
        description={`Se liquidará la ronda con puntaje ${value} de 5 (${valid ? formatMultiplier(multiplierForScore(value)) : "—"}). No se puede deshacer.`}
      >
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            loadingLabel="Liquidando"
            onClick={() => void confirm()}
          >
            Liquidar ronda
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
