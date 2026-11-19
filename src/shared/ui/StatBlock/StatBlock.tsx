import type { ReactNode } from "react";
import styles from "./StatBlock.module.css";

export interface StatBlockProps {
  /** Etiqueta que describe el valor. Se muestra en mayúsculas mediante CSS. */
  label: ReactNode;
  /** Valor principal, normalmente un número formateado. */
  value: ReactNode;
  /** Alineación del contenido. Predeterminado: "start". */
  align?: "start" | "end";
  /** Tamaño del valor. "lg" se usa para cifras destacadas. Predeterminado: "md". */
  size?: "md" | "lg";
  className?: string;
}

/** Par etiqueta y valor, expuesto como lista de descripción para lectores de pantalla. */
export function StatBlock({
  label,
  value,
  align = "start",
  size = "md",
  className,
}: StatBlockProps) {
  const classes = [styles.block, styles[align], className].filter(Boolean).join(" ");
  const valueClass = [styles.value, styles[size]].join(" ");

  return (
    <dl className={classes}>
      <div className={styles.item}>
        <dt className={styles.label}>{label}</dt>
        <dd className={valueClass}>{value}</dd>
      </div>
    </dl>
  );
}
