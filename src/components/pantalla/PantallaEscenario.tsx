import type { ReactNode } from "react";
import styles from "./pantalla.module.css";

interface PantallaEscenarioProps {
  /** Etiqueta de la fase activa, mostrada en el encabezado. */
  etiquetaFase: string;
  children: ReactNode;
}

/** Marco 16:9 de la pantalla. Solo presenta contenido; no contiene controles de escritura. */
export function PantallaEscenario({ etiquetaFase, children }: PantallaEscenarioProps) {
  return (
    <div className={styles.pantalla}>
      <div className={styles.escenario}>
        <header className={styles.encabezado}>
          <span className={styles.marca}>Start Tank</span>
          <span className={styles.etiquetaFase}>{etiquetaFase}</span>
        </header>
        <main className={styles.cuerpo}>{children}</main>
      </div>
    </div>
  );
}
