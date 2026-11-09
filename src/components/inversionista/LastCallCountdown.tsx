import { EVENT_CONFIG } from "@/lib/domain/config";
import styles from "./LastCallCountdown.module.css";

interface LastCallCountdownProps {
  /** Segundos restantes antes del cierre automático. */
  seconds: number;
}

/** Formatea segundos como m:ss, por ejemplo "0:42". */
function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
}

/** Cuenta regresiva de la última llamada con barra que se vacía hasta el cierre. */
export function LastCallCountdown({ seconds }: LastCallCountdownProps) {
  const fillPercent = Math.min(100, (seconds / EVENT_CONFIG.lastCallSeconds) * 100);

  return (
    <div className={styles.countdown}>
      <span className={styles.label}>Cierre automático en</span>
      <span className={styles.clock} aria-live="polite">
        {formatClock(seconds)}
      </span>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${fillPercent}%` }} />
      </div>
    </div>
  );
}
