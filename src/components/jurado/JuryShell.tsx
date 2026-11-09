import type { ReactNode } from "react";
import styles from "./JuryShell.module.css";

interface JuryShellProps {
  jurorLabel: string | null;
  children: ReactNode;
}

/** Marco de la laptop del jurado: encabezado con identidad y área de contenido centrada. */
export function JuryShell({ jurorLabel, children }: JuryShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.wordmark}>Start Tank</span>
          <span className={styles.section}>Portal del jurado</span>
        </div>
        {jurorLabel !== null && (
          <span className={styles.juror}>{jurorLabel}</span>
        )}
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
