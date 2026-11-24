import type { HealthLevel, HealthSignal } from "../types";

import styles from "./Admin.module.css";

const LEVEL_TEXT: Record<HealthLevel, string> = {
  ok: "en verde",
  warning: "en ámbar",
  critical: "en rojo",
};

interface HealthBarProps {
  signals: readonly HealthSignal[];
}

/** Semáforo de base de datos, jurados y teléfonos (RF-26). El color se acompaña de texto. */
export function HealthBar({ signals }: HealthBarProps) {
  return (
    <ul className={styles.healthBar} aria-label="Salud del sistema">
      {signals.map((signal) => (
        <li key={signal.id} className={`${styles.healthPill} ${styles[`level-${signal.level}`]}`}>
          <span className={styles.healthDot} aria-hidden="true" />
          <span>{signal.label}</span>
          <span className={styles.healthValue}>{signal.value}</span>
          <span className={styles.srOnly}>{LEVEL_TEXT[signal.level]}</span>
        </li>
      ))}
    </ul>
  );
}
