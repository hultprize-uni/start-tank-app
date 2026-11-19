import styles from "./Countdown.module.css";

export interface CountdownProps {
  /** Segundos restantes. Los valores negativos se muestran como 00:00. */
  seconds: number;
  /** Nombre accesible del contador, por ejemplo "Tiempo de la última llamada". */
  label?: string;
  /** Tono del texto. "warning" resalta el contador en los últimos segundos. Predeterminado: "default". */
  tone?: "default" | "warning";
  className?: string;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/** Contador presentacional en formato mm:ss. No mantiene temporizador propio. */
export function Countdown({ seconds, label, tone = "default", className }: CountdownProps) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  const text = `${pad(minutes)}:${pad(remainder)}`;
  const dateTime = `PT${minutes}M${remainder}S`;
  const classes = [styles.countdown, styles[tone], className].filter(Boolean).join(" ");

  return (
    <time dateTime={dateTime} aria-label={label} className={classes}>
      {text}
    </time>
  );
}
