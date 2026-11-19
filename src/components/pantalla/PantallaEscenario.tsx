import type { ReactNode } from "react";
import styles from "./pantalla.module.css";

interface ScreenStageProps {
  /** Etiqueta de la fase activa, mostrada en el encabezado. */
  phaseLabel: string;
  children: ReactNode;
}

/** Marco 16:9 de la pantalla. Solo presenta contenido; no contiene controles de escritura. */
export function ScreenStage({ phaseLabel: phaseLabel, children }: ScreenStageProps) {
  return (
    <div className={styles.screen}>
      <div className={styles.stage}>
        <header className={styles.header}>
          <span className={styles.brand}>Start Tank</span>
          <span className={styles.phaseLabel}>{phaseLabel}</span>
        </header>
        <main className={styles.body}>{children}</main>
      </div>
    </div>
  );
}
