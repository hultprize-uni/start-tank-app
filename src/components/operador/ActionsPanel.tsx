import type {
  OperatorActionId,
  OperatorActionView,
} from "@/lib/api/operator.types";

import styles from "./OperatorConsole.module.css";

interface ActionsPanelProps {
  actions: OperatorActionView[];
  onRunAction: (id: OperatorActionId) => void;
}

/** Cinco acciones de la ronda en orden. Muestra si cada una está hecha, disponible o bloqueada. */
export function ActionsPanel({ actions, onRunAction }: ActionsPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="acciones-ronda">
      <div className={styles.panelHeader}>
        <h3 id="acciones-ronda" className={styles.panelTitle}>
          Acciones
        </h3>
      </div>
      <ol className={styles.actionList}>
        {actions.map((action, index) => (
          <li key={action.id} className={styles.actionRow}>
            <span className={styles.actionNumber} aria-hidden="true">
              {index + 1}
            </span>
            <div className={styles.actionMeta}>
              <span className={styles.actionState}>
                {action.done ? (
                  <span className={styles.actionStateDone}>Hecho</span>
                ) : action.blockedReason ? (
                  <span className={styles.actionStateBlocked}>
                    {action.blockedReason}
                  </span>
                ) : action.enabled ? (
                  <span className={styles.actionStateNext}>Disponible</span>
                ) : (
                  <span>Pendiente</span>
                )}
              </span>
            </div>
            <button
              type="button"
              className={`${styles.button} ${action.enabled ? styles.buttonPrimary : ""}`}
              disabled={!action.enabled}
              onClick={() => onRunAction(action.id)}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
