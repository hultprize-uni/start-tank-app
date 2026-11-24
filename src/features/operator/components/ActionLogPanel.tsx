import type { LogEntryView } from "../types";

import panel from "./Panel.module.css";
import styles from "./Admin.module.css";

interface ActionLogPanelProps {
  /** Entradas del log, de la más reciente a la más antigua. */
  entries: readonly LogEntryView[];
  /** Cantidad de entradas visibles. Sin límite muestra la tabla completa. */
  limit?: number;
}

/** Log de acciones con operador, hora y motivo (RF-09). */
export function ActionLogPanel({ entries, limit }: ActionLogPanelProps) {
  if (limit !== undefined) {
    const visible = entries.slice(0, limit);
    return (
      <section className={panel.panel} aria-labelledby="log-acciones">
        <div className={panel.header}>
          <h2 id="log-acciones" className={panel.title}>
            Log de acciones
          </h2>
        </div>
        {visible.length === 0 ? (
          <p className={panel.muted}>Sin acciones todavía.</p>
        ) : (
          <ol className={panel.list}>
            {visible.map((entry) => (
              <li key={entry.id} className={panel.logItem}>
                <span className={panel.logLabel}>
                  {entry.operator} · {entry.label}
                  {entry.reason !== null ? (
                    <span className={panel.muted}> — {entry.reason}</span>
                  ) : null}
                </span>
                <time className={panel.logMeta} dateTime={entry.at}>
                  {entry.time} · R{entry.roundNumber}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  return (
    <section className={panel.panel} aria-labelledby="log-completo">
      <div className={panel.header}>
        <h2 id="log-completo" className={panel.title}>
          Log de acciones
        </h2>
        <span className={panel.muted}>{entries.length} acciones</span>
      </div>
      {entries.length === 0 ? (
        <p className={panel.muted}>Sin acciones todavía.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Ronda</th>
                <th scope="col">Operador</th>
                <th scope="col">Acción</th>
                <th scope="col">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className={styles.num}>
                    <time dateTime={entry.at}>{entry.time}</time>
                  </td>
                  <td className={styles.num}>{entry.roundNumber}</td>
                  <td>{entry.operator}</td>
                  <td>{entry.label}</td>
                  <td>{entry.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
