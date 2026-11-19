import styles from "./Spinner.module.css";

export interface SpinnerProps {
  /** Texto accesible que anuncia la carga. Predeterminado: "Cargando". */
  label?: string;
  /** Oculta el indicador de las tecnologías de apoyo, para contextos que ya comunican la carga. */
  decorative?: boolean;
  /** Diámetro del aro en píxeles. Predeterminado: 20. */
  size?: number;
  className?: string;
}

/** Indicador de carga circular. Se anuncia como estado salvo que sea decorativo. */
export function Spinner({
  label = "Cargando",
  decorative = false,
  size = 20,
  className,
}: SpinnerProps) {
  const ringClass = [styles.ring, className].filter(Boolean).join(" ");
  const dimensions = { width: size, height: size };

  if (decorative) {
    return <span aria-hidden="true" className={ringClass} style={dimensions} />;
  }

  return (
    <span role="status" aria-label={label} className={styles.wrapper}>
      <span aria-hidden="true" className={ringClass} style={dimensions} />
    </span>
  );
}
