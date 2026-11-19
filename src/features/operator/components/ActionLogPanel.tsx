import type { LogEntryView } from "../types";

import panel from "./Panel.module.css";

/** Número máximo de entradas visibles del registro. El registro completo está disponible en la exportación. */
const VISIBLE_ENTRIES = 8;

interface ActionLogPanelProps {
  /** Entradas del registro, de la más reciente a la más antigua. */
  entries: LogEntryView[];
}

/** Registro de acciones del operador, con las entradas más recientes primero. */
export function ActionLogPanel({ entries }: ActionLogPanelProps) {
  const visible = entries.slice(0, VISIBLE_ENTRIES);

  return (
    <section className={panel.panel} aria-labelledby="registro-acciones">
      <div className={panel.header}>
        <h2 id="registro-acciones" className={panel.title}>
          Registro de acciones
        </h2>
      </div>
      {visible.length === 0 ? (
        <p className={panel.muted}>Sin acciones todavía.</p>
      ) : (
        <ol className={panel.list}>
          {visible.map((entry) => (
            <li key={entry.id} className={panel.logItem}>
              <span className={panel.logLabel}>{entry.label}</span>
              <time className={panel.logMeta}>
                {entry.time} · R{entry.roundNumber}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
