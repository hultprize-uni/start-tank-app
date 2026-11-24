"use client";

import { useState } from "react";
import { Button, Dialog } from "@/shared/ui";
import { ABSTAIN_REASONS } from "../criteria";
import { useIsDesktop } from "../hooks/useIsDesktop";
import styles from "./AbstainSheet.module.css";

interface AbstainSheetProps {
  open: boolean;
  startupName: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

interface AbstainSheetBodyProps {
  startupName: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function AbstainSheetBody({
  startupName,
  submitting,
  onClose,
  onConfirm,
}: AbstainSheetBodyProps) {
  // El motivo se exige solo para confirmar en la interfaz; nunca se envía ni se guarda en la base.
  const [reason, setReason] = useState<string | null>(null);

  return (
    <div className={styles.body}>
      <p className={styles.lead}>
        Tu abstención se excluye del promedio de <strong>{startupName}</strong>. El motivo no se
        almacena en el sistema.
      </p>

      <div
        role="radiogroup"
        aria-label="Motivo del conflicto de interés"
        className={styles.reasons}
      >
        {ABSTAIN_REASONS.map((item) => {
          const checked = reason === item;
          return (
            <label
              key={item}
              className={`${styles.reason} ${checked ? styles.selected : ""}`}
            >
              <input
                type="radio"
                className="visually-hidden"
                name="abstain-reason"
                value={item}
                checked={checked}
                disabled={submitting}
                onChange={() => setReason(item)}
              />
              <span>{item}</span>
            </label>
          );
        })}
      </div>

      <p className={styles.warning}>
        Esta acción es definitiva. No podrás calificar esta ronda.
      </p>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Volver
        </Button>
        <Button
          disabled={reason === null || submitting}
          loading={submitting}
          loadingLabel="Registrando abstención"
          onClick={() => onConfirm()}
        >
          Confirmar abstención
        </Button>
      </div>
    </div>
  );
}

/**
 * Hoja de confirmación de abstención por conflicto de interés (RF-15). Pide elegir un motivo en
 * el diálogo antes de confirmar, pero no lo persiste ni lo transmite al servidor.
 */
export function AbstainSheet({
  open,
  startupName,
  submitting,
  onClose,
  onConfirm,
}: AbstainSheetProps) {
  const isDesktop = useIsDesktop();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Declarar conflicto de interés"
      description="Abstención en la ronda actual"
      placement={isDesktop ? "center" : "bottom"}
      closeOnBackdrop={!submitting}
    >
      {open ? (
        <AbstainSheetBody
          startupName={startupName}
          submitting={submitting}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      ) : null}
    </Dialog>
  );
}
