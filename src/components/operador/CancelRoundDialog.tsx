"use client";

import { useEffect, useState } from "react";

import type { CancelMode } from "@/lib/api/operator.types";

import styles from "./OperatorConsole.module.css";

interface CancelRoundDialogProps {
  roundNumber: number;
  startupName: string;
  onClose: () => void;
  onConfirm: (mode: CancelMode) => void;
}

type Step = "elegir" | "confirmar";

const MODE_OPTIONS: { mode: CancelMode; title: string; hint: string }[] = [
  {
    mode: "devolver",
    title: "Devolver lo invertido",
    hint: "Cada asistente recupera el monto invertido en la ronda.",
  },
  {
    mode: "liquidar_1x",
    title: "Liquidar a 1.0x",
    hint: "La ronda se liquida con multiplicador 1.0x, lo que equivale a devolver lo invertido.",
  },
];

/**
 * Diálogo de anulación en dos pasos: elegir el modo y confirmar la acción.
 * Se monta solo cuando está abierto, por lo que su estado interno se reinicia en cada apertura.
 */
export function CancelRoundDialog({
  roundNumber,
  startupName,
  onClose,
  onConfirm,
}: CancelRoundDialogProps) {
  const [step, setStep] = useState<Step>("elegir");
  const [mode, setMode] = useState<CancelMode>("devolver");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const selected = MODE_OPTIONS.find((option) => option.mode === mode);

  return (
    <div className={styles.overlay}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="anular-titulo"
      >
        {step === "elegir" ? (
          <>
            <h3 id="anular-titulo" className={styles.dialogTitle}>
              Anular ronda {roundNumber}
            </h3>
            <p className={styles.dialogText}>
              Elige cómo se resuelve la ronda de {startupName}. El paso siguiente
              pide confirmación.
            </p>
            <fieldset className={styles.radioGroup}>
              <legend className={styles.muted}>Modo de anulación</legend>
              {MODE_OPTIONS.map((option) => (
                <label
                  key={option.mode}
                  className={`${styles.radioOption} ${
                    option.mode === mode ? styles.radioOptionSelected : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="modo-anulacion"
                    value={option.mode}
                    checked={option.mode === mode}
                    onChange={() => setMode(option.mode)}
                    className={styles.radio}
                  />
                  <span>
                    <span className={styles.radioTitle}>{option.title}</span>
                    <span className={styles.radioHint}>{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.button} onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonDanger}`}
                onClick={() => setStep("confirmar")}
              >
                Continuar
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 id="anular-titulo" className={styles.dialogTitle}>
              Confirmar anulación
            </h3>
            <p className={styles.dialogText}>
              Se anulará la ronda {roundNumber} ({startupName}) con la opción
              &quot;{selected?.title}&quot;. Esta acción queda en el registro y no
              se puede deshacer desde esta pantalla.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.button}
                onClick={() => setStep("elegir")}
              >
                Volver
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonDanger}`}
                onClick={() => onConfirm(mode)}
              >
                Anular ronda
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
