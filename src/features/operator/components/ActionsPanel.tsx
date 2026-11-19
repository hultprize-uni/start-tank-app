"use client";

import { Button } from "@/shared/ui";

import type {
  OperatorActionId,
  OperatorActionView,
  RoundStatus,
} from "../types";

import panel from "./Panel.module.css";

interface ActionsPanelProps {
  actions: OperatorActionView[];
  roundStatus: RoundStatus;
  onRunAction: (id: OperatorActionId) => void;
}

/**
 * Texto de estado de una acción. Solo el paso actual muestra su motivo o su siguiente paso;
 * los pasos hechos se marcan como tales y los pendientes no muestran texto.
 */
function noteOf(action: OperatorActionView, current: boolean, roundStatus: RoundStatus): string | null {
  if (action.done) return "Hecho";
  if (!current) return null;
  if (action.blockedReason !== null) return action.blockedReason;
  if (action.id === "close" && roundStatus === "LAST_CALL") {
    return "Se cierra sola al llegar a 0:00";
  }
  return "Siguiente acción";
}

/**
 * Acciones de la ronda en orden. El veredicto permanece bloqueado hasta que voten todos los
 * jurados, y su motivo se anuncia junto al botón mediante aria-describedby.
 */
export function ActionsPanel({ actions, roundStatus, onRunAction }: ActionsPanelProps) {
  const currentIndex = actions.findIndex((action) => !action.done);

  return (
    <section className={panel.panel} aria-labelledby="acciones-ronda">
      <div className={panel.header}>
        <h2 id="acciones-ronda" className={panel.title}>
          Acciones de la ronda
        </h2>
      </div>
      <ol className={panel.list}>
        {actions.map((action, index) => {
          const current = index === currentIndex;
          const note = noteOf(action, current, roundStatus);
          const noteId = `accion-${action.id}-nota`;
          const isLocked = current && action.blockedReason !== null && action.id === "reveal";
          const rowClass = [
            panel.actionRow,
            current ? panel.actionCurrent : "",
            isLocked ? panel.actionLocked : "",
            action.done ? panel.actionDone : "",
          ]
            .filter(Boolean)
            .join(" ");
          const noteClass = action.done
            ? panel.actionNoteDone
            : action.blockedReason !== null && current
              ? panel.actionNoteBlocked
              : panel.note;

          return (
            <li key={action.id} className={rowClass}>
              <span className={panel.actionIndex} aria-hidden="true">
                {index + 1}
              </span>
              <div className={panel.actionMeta}>
                {note !== null ? (
                  <span id={noteId} className={noteClass}>
                    {note}
                  </span>
                ) : null}
              </div>
              <Button
                variant={action.enabled && current ? "primary" : "ghost"}
                disabled={!action.enabled}
                aria-describedby={note !== null ? noteId : undefined}
                onClick={() => onRunAction(action.id)}
              >
                {action.label}
              </Button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
