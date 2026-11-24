"use client";

import { Button } from "@/shared/ui";

import type { AlertAction, HealthAlert } from "../types";

import styles from "./Admin.module.css";

/** Texto del botón de la acción sugerida de cada alerta. */
const ACTION_LABELS: Record<AlertAction, string> = {
  rescue: "Revelar con presentes",
  manual_mode: "Ir al modo manual",
  attendees: "Ver asistentes",
  retry: "Reintentar",
};

interface AlertBannerProps {
  alerts: readonly HealthAlert[];
  /** Las acciones de rescate y modo manual solo se ofrecen al conductor. */
  canAct: boolean;
  /** El rescate solo se ofrece si la ronda lo admite. */
  canRescue: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onAction: (action: AlertAction) => void;
}

/**
 * Alertas de salud con su acción sugerida (RF-26, tarea 5.9). Las críticas entran desde arriba,
 * pulsan dos veces y quedan fijas mientras sigan activas; suenan una vez (ver useAlertSound).
 */
export function AlertBanner({
  alerts,
  canAct,
  canRescue,
  muted,
  onToggleMuted,
  onAction,
}: AlertBannerProps) {
  const actionAllowed = (action: AlertAction) => {
    if (action === "rescue") return canAct && canRescue;
    if (action === "manual_mode") return true;
    return true;
  };

  return (
    <section aria-label="Alertas activas">
      <div className={styles.alertsHeader}>
        <button
          type="button"
          className={styles.iconButton}
          aria-pressed={muted}
          onClick={onToggleMuted}
        >
          {muted ? "Sonido de alertas: apagado" : "Sonido de alertas: encendido"}
        </button>
      </div>
      {alerts.length > 0 ? (
        <ul className={styles.alerts} role="alert" aria-live="assertive">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={`${styles.alert} ${alert.level === "critical" ? styles.alertCritical : ""}`}
            >
              <span className={styles.alertIcon} aria-hidden="true">
                !
              </span>
              <div className={styles.alertText}>
                <p className={styles.alertTitle}>{alert.title}</p>
                <p className={styles.alertDetail}>{alert.detail}</p>
              </div>
              {alert.action !== null && actionAllowed(alert.action) ? (
                <Button variant="ghost" onClick={() => onAction(alert.action as AlertAction)}>
                  {ACTION_LABELS[alert.action]}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
