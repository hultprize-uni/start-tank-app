import type { LogEntryView } from "@/lib/api/operator.types";

import styles from "./OperatorConsole.module.css";

interface ActionLogPanelProps {
  entries: LogEntryView[];
}

/** Registro de acciones de la ronda, en orden cronológico. */
export function ActionLogPanel({ entries }: ActionLogPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="registro-acciones">
      <div className={styles.panelHeader}>
        <h3 id="registro-acciones" className={styles.panelTitle}>
          Registro de acciones
        </h3>
      </div>
      {entries.length === 0 ? (
        <p className={styles.muted}>Sin acciones registradas en esta ronda.</p>
      ) : (
        <ol className={styles.logList}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.logItem}>
              <time className={styles.logTime}>{entry.time}</time>
              <span>
                <span className={styles.logLabel}>{entry.label}</span>
                {entry.detail ? ` · ${entry.detail}` : ""}{" "}
                <span className={styles.logOperator}>· {entry.operator}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
