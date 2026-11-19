import type { ReactNode } from "react";
import styles from "./ParticipantShell.module.css";

interface ParticipantShellProps {
  /** Verdadero para el diseño de escritorio: riel lateral y dos columnas. */
  isDesktop: boolean;
  /** Cabecera del móvil. No se muestra en escritorio. */
  header: ReactNode;
  /** Barra lateral del escritorio. No se muestra en el móvil. */
  sidebar: ReactNode;
  /** Pantalla de la ronda: columna principal. */
  primary: ReactNode;
  /** Paneles complementarios: inversión en escritorio, clasificación e historial. */
  secondary: ReactNode;
}

/**
 * Estructura responsive del portal. En el móvil apila cabecera, pantalla y paneles. En el escritorio
 * coloca la barra lateral a la izquierda y reparte la pantalla y los paneles en dos columnas.
 */
export function ParticipantShell({ isDesktop, header, sidebar, primary, secondary }: ParticipantShellProps) {
  if (isDesktop) {
    return (
      <div className={styles.desktop}>
        {sidebar}
        <div className={styles.columns}>
          <div className={styles.primary}>{primary}</div>
          <div className={styles.secondary}>{secondary}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mobile}>
      {header}
      <div className={styles.stack}>
        <div>{primary}</div>
        <div className={styles.secondary}>{secondary}</div>
      </div>
    </div>
  );
}
