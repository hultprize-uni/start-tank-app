import type { ReactNode } from "react";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { AnimatedBackground, Badge, BrandLogo, LiveDot } from "@/shared/ui";
import type { PhaseStatus } from "./phases";
import styles from "./screen.module.css";

interface ScreenStageProps {
  /** Estado de la fase activa, mostrado en el encabezado. */
  status: PhaseStatus;
  /** Número de la ronda en el encabezado. Se omite cuando la fase no se refiere a una ronda. */
  roundNumber?: number;
  /** Verdadero cuando la última consulta falló y se muestra la lectura anterior. */
  offline: boolean;
  children: ReactNode;
}

/*
 * Marco 16:9 de la pantalla. Presenta el encabezado, el cuerpo de la fase y el pie de actualización.
 * No contiene controles de escritura.
 */
export function ScreenStage({ status, roundNumber, offline, children }: ScreenStageProps) {
  const pollSeconds = EVENT_CONFIG.screenPollMs / 1000;

  return (
    <div className={styles.screen}>
      <div className={styles.stage}>
        <AnimatedBackground fixed={false} />
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <BrandLogo variant="horizontal" priority className={styles.brandLogo} />
            <span className={styles.brandNote}>Hult Prize at UNI</span>
          </div>
          <div className={styles.headerRight}>
            {roundNumber !== undefined ? (
              <span className={styles.roundLabel}>Ronda {roundNumber}</span>
            ) : null}
            <div className={styles.status}>
              <Badge tone={status.tone} live={status.live}>
                {status.label}
              </Badge>
            </div>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
        <footer className={styles.footer}>
          <span className={styles.footerLive}>
            <LiveDot tone="cyan" />
            Actualiza cada {pollSeconds} segundos
          </span>
          {offline ? (
            <span role="status" className={styles.offlineNote}>
              Sin conexión. Se muestra la última lectura.
            </span>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
