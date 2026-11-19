import type { ReactNode } from "react";
import styles from "./Toast.module.css";

export type ToastTone = "neutral" | "positive" | "negative" | "warning";

export interface ToastProps {
  /** Mensaje que se muestra. Recibe texto o nodos; el componente no incluye textos fijos. */
  children: ReactNode;
  /** Tono que indica el tipo de mensaje. Predeterminado: "neutral". */
  tone?: ToastTone;
  /** Región que anuncia el mensaje. "status" para avisos y "alert" para errores urgentes. Predeterminado: "status". */
  role?: "status" | "alert";
  /** Acción opcional, por ejemplo un botón de deshacer. */
  action?: ReactNode;
  className?: string;
}

/**
 * Notificación presentacional. No gestiona posición ni tiempo de vida: el consumidor
 * decide dónde se muestra y cuándo se retira.
 */
export function Toast({
  children,
  tone = "neutral",
  role = "status",
  action,
  className,
}: ToastProps) {
  const classes = [styles.toast, styles[tone], className].filter(Boolean).join(" ");

  return (
    <div role={role} className={classes}>
      <div className={styles.message}>{children}</div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
