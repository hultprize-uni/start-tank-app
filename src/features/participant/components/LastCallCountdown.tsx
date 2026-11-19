import { Countdown, ProgressBar } from "@/shared/ui";
import { EVENT_CONFIG } from "@/shared/domain/config";
import styles from "./LastCallCountdown.module.css";

/** Segundos finales en los que el contador cambia a tono de aviso. */
const WARNING_SECONDS = 10;

interface LastCallCountdownProps {
  /** Segundos restantes antes del cierre automático. */
  seconds: number;
}

/** Cuenta regresiva de la última llamada con una barra que se vacía hasta el cierre. */
export function LastCallCountdown({ seconds }: LastCallCountdownProps) {
  const isWarning = seconds <= WARNING_SECONDS;

  return (
    <div className={styles.countdown}>
      <span className={styles.label}>Cierre automático en</span>
      <Countdown
        seconds={seconds}
        label="Tiempo restante de la última llamada"
        tone={isWarning ? "warning" : "default"}
      />
      <ProgressBar
        value={seconds}
        max={EVENT_CONFIG.lastCallSeconds}
        label="Barra de tiempo de la última llamada"
        valueText={`${seconds} segundos`}
        tone="yellow"
      />
    </div>
  );
}
