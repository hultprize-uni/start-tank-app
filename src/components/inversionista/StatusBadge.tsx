import styles from "./StatusBadge.module.css";

export type StatusTone = "yellow" | "cyan" | "pink";

interface StatusBadgeProps {
  tone: StatusTone;
  /** Muestra un punto que pulsa para indicar estado en vivo. */
  live?: boolean;
  children: React.ReactNode;
}

/** Etiqueta de estado de la ronda. */
export function StatusBadge({ tone, live = false, children }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {live && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
