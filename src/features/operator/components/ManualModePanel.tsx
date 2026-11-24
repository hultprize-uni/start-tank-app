"use client";

import { useState } from "react";

import { Button, Dialog, Toast } from "@/shared/ui";

import { ReasonField } from "./ReasonField";
import panel from "./Panel.module.css";
import styles from "./Admin.module.css";

interface ManualModePanelProps {
  enabled: boolean;
  /** Último corte liquidado, que queda vigente en modo manual. */
  lastSettledRound: { number: number; startupName: string } | null;
  canWrite: boolean;
  /** Activa o desactiva el modo manual. Devuelve el mensaje de error o null. */
  onToggle: (enabled: boolean, reason: string | null) => Promise<string | null>;
}

/**
 * Modo manual (RF-27, RNF-08, CU-18): congela el ranking en el último corte liquidado y lo marca en
 * la pantalla. Se usa si la aplicación no responde por más de 90 segundos. Se confirma en un
 * diálogo con un motivo opcional que queda en el log.
 */
export function ManualModePanel({
  enabled,
  lastSettledRound,
  canWrite,
  onToggle,
}: ManualModePanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cut =
    lastSettledRound === null
      ? "Aún no hay rondas liquidadas."
      : `Corte vigente: ronda ${lastSettledRound.number} (${lastSettledRound.startupName}).`;

  async function confirm() {
    setSending(true);
    const failure = await onToggle(!enabled, reason.trim() === "" ? null : reason.trim());
    setSending(false);
    if (failure === null) {
      setConfirming(false);
      setReason("");
      setError(null);
    } else {
      setError(failure);
    }
  }

  return (
    <section className={panel.panel} aria-labelledby="modo-manual">
      <div className={panel.header}>
        <h2 id="modo-manual" className={panel.title}>
          Modo manual
        </h2>
        <span className={panel.muted}>{enabled ? "Activo" : "Inactivo"}</span>
      </div>
      <p className={panel.note}>
        Úsalo si la aplicación no responde por más de 90 segundos. Congela el ranking en el último
        corte liquidado, lo marca en la pantalla y te permite liquidar a mano.
      </p>
      <p className={enabled ? styles.manualBanner : panel.note}>{cut}</p>
      {canWrite ? (
        <div>
          <Button variant={enabled ? "ghost" : "danger"} onClick={() => setConfirming(true)}>
            {enabled ? "Desactivar modo manual" : "Activar modo manual"}
          </Button>
        </div>
      ) : (
        <p className={panel.note}>Solo el conductor puede activarlo.</p>
      )}
      {error !== null ? (
        <Toast tone="negative" role="alert">
          {error}
        </Toast>
      ) : null}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={enabled ? "¿Desactivar el modo manual?" : "¿Activar el modo manual?"}
        description={
          enabled
            ? "El ranking vuelve a actualizarse con cada liquidación."
            : `El ranking queda congelado en el último corte. ${cut}`
        }
      >
        <div className={styles.form}>
          <ReasonField
            value={reason}
            onChange={setReason}
            label="Motivo (opcional, queda en el log)"
          />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button
              variant={enabled ? "primary" : "danger"}
              loading={sending}
              loadingLabel="Guardando"
              onClick={() => void confirm()}
            >
              {enabled ? "Desactivar" : "Activar modo manual"}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
