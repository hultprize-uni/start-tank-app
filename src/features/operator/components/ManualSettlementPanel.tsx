"use client";

import { useState } from "react";

import { Button, Dialog, SegmentedChoice, Toast } from "@/shared/ui";
import type { ToastTone } from "@/shared/ui";

import { submitManualSettlement } from "../api/client";

import panel from "./Panel.module.css";

/** Cantidad de respaldos que el operador puede indicar: de 0 a 4 jurados. */
const BACKS_OPTIONS = [0, 1, 2, 3, 4].map((value) => ({
  value: String(value),
  label: String(value),
}));

/** Cantidad total de jurados que la liquidación manual reporta en la confirmación. */
const JURY_TOTAL = 4;

interface Feedback {
  tone: ToastTone;
  role: "status" | "alert";
  message: string;
}

interface ManualSettlementPanelProps {
  /** Indica si la ronda admite liquidación manual: solo en estados CERRADA o EN_VOTACION. */
  available: boolean;
}

/**
 * Liquidación manual de la ronda activa. El operador elige los respaldos, confirma en un diálogo
 * y el servidor liquida la ronda. Fuera de los estados CERRADA y EN_VOTACION el panel no se muestra.
 */
export function ManualSettlementPanel({ available }: ManualSettlementPanelProps) {
  const [backs, setBacks] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!available) {
    return null;
  }

  async function confirm() {
    setSubmitting(true);
    const result = await submitManualSettlement(backs);
    setSubmitting(false);
    setConfirming(false);
    if (result.ok) {
      setFeedback({
        tone: "positive",
        role: "status",
        message: `Ronda liquidada con multiplicador ${result.value.multiplicador.toFixed(3)}x.`,
      });
      return;
    }
    setFeedback({ tone: "negative", role: "alert", message: result.message });
  }

  return (
    <div className={panel.controlItem}>
      <p id="liquidacion-manual-titulo" className={panel.title}>
        Liquidación manual
      </p>
      <p id="liquidacion-manual-ayuda" className={panel.note}>
        Liquida la ronda a mano si falla el voto digital.
      </p>

      <SegmentedChoice
        label="Respaldos del jurado"
        options={BACKS_OPTIONS}
        value={String(backs)}
        onChange={(value) => setBacks(Number(value))}
        disabled={submitting}
      />

      <Button variant="danger" disabled={submitting} onClick={() => setConfirming(true)}>
        Liquidar a mano
      </Button>

      {feedback !== null ? (
        <Toast tone={feedback.tone} role={feedback.role}>
          {feedback.message}
        </Toast>
      ) : null}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirmar liquidación manual"
        description={`¿Confirmas liquidar la ronda con ${backs} de ${JURY_TOTAL} respaldos? Esta acción no se puede deshacer.`}
      >
        <div className={panel.controls}>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={submitting} onClick={confirm}>
            Liquidar ronda
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
