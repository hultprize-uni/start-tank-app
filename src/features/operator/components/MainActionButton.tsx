"use client";

import { Button } from "@/shared/ui";

import type { MainActionView, OperatorActionId } from "../types";

import styles from "./Admin.module.css";

interface MainActionButtonProps {
  action: MainActionView;
  busy: boolean;
  onRun: (id: OperatorActionId) => void;
}

/**
 * Botón principal contextual (RF-06): muestra solo el paso válido de la ronda. Si el paso está
 * bloqueado, el motivo se anuncia junto al botón.
 */
export function MainActionButton({ action, busy, onRun }: MainActionButtonProps) {
  const noteId = `paso-${action.id}-nota`;
  const note = action.blockedReason ?? action.hint;
  return (
    <>
      <Button
        size="lg"
        className={styles.mainButton}
        disabled={!action.enabled || busy}
        loading={busy}
        loadingLabel="Enviando la acción"
        aria-describedby={note !== null ? noteId : undefined}
        onClick={() => onRun(action.id)}
      >
        {action.label}
      </Button>
      {note !== null ? (
        <p
          id={noteId}
          className={`${styles.mainNote} ${action.blockedReason !== null ? styles.mainNoteBlocked : ""}`}
        >
          {note}
        </p>
      ) : null}
    </>
  );
}
