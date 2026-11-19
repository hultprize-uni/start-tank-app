import styles from "./LiveDot.module.css";

export type LiveDotTone = "current" | "cyan" | "pink" | "yellow";

export interface LiveDotProps {
  /** Color del punto. "current" hereda el color del texto que lo contiene. */
  tone?: LiveDotTone;
  /** Texto accesible. Sin valor, el punto es decorativo y se oculta de las tecnologías de apoyo. */
  label?: string;
  className?: string;
}

/** Punto pulsante que indica un estado en vivo. */
export function LiveDot({ tone = "current", label, className }: LiveDotProps) {
  const classes = [styles.dot, styles[tone], className].filter(Boolean).join(" ");

  if (label) {
    return <span role="img" aria-label={label} className={classes} />;
  }

  return <span aria-hidden="true" className={classes} />;
}
