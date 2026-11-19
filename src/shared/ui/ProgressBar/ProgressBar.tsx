import styles from "./ProgressBar.module.css";

export type ProgressBarTone = "brand" | "cyan" | "pink" | "yellow";

export interface ProgressBarProps {
  /** Valor actual. Se limita al intervalo entre 0 y max. */
  value: number;
  /** Valor máximo que representa el 100 %. Predeterminado: 100. */
  max?: number;
  /** Nombre accesible de la barra. Es obligatorio para que el progreso se identifique. */
  label: string;
  /** Texto legible del valor, por ejemplo "3 de 5 rondas". Se expone como aria-valuetext. */
  valueText?: string;
  /** Color del relleno. "brand" usa el degradado de la marca. Predeterminado: "brand". */
  tone?: ProgressBarTone;
  className?: string;
}

/** Barra de progreso con semántica role="progressbar" y valores ARIA. */
export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
  tone = "brand",
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = (clamped / safeMax) * 100;
  const trackClass = [styles.track, className].filter(Boolean).join(" ");
  const fillClass = [styles.fill, styles[tone]].join(" ");

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      className={trackClass}
    >
      <div className={fillClass} style={{ width: `${percent}%` }} />
    </div>
  );
}
