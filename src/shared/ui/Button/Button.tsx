import type { ButtonHTMLAttributes, Ref } from "react";
import { Spinner } from "../Spinner";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Estilo visual. "primary" usa el acento; "ghost" es de contorno; "danger" marca acciones destructivas. */
  variant?: ButtonVariant;
  /** Tamaño. "lg" aumenta la altura y el relleno, con 52 px de objetivo táctil. */
  size?: ButtonSize;
  /** Muestra un indicador de carga, deshabilita el botón y marca aria-busy. */
  loading?: boolean;
  /** Texto accesible añadido mientras el botón está cargando. Predeterminado: "Cargando". */
  loadingLabel?: string;
  /** Ocupa todo el ancho disponible del contenedor. */
  fullWidth?: boolean;
  /** Referencia al elemento button nativo. */
  ref?: Ref<HTMLButtonElement>;
}

/** Botón de acción. Usa button nativo; el tipo predeterminado es "button" para evitar envíos accidentales. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Cargando",
  fullWidth = false,
  disabled = false,
  type = "button",
  className,
  children,
  ref,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : null,
    loading ? styles.loading : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <Spinner decorative size={size === "lg" ? 20 : 16} />
      ) : null}
      <span>{children}</span>
      {loading ? <span className="visually-hidden">{loadingLabel}</span> : null}
    </button>
  );
}
