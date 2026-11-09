import type { ButtonHTMLAttributes } from "react";
import styles from "./ActionButton.module.css";

type ActionVariant = "primary" | "ghost" | "muted";
type ActionSize = "md" | "lg";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionVariant;
  size?: ActionSize;
}

/** Botón de acción de pastilla. Variante primary para la acción principal. */
export function ActionButton({
  variant = "primary",
  size = "lg",
  className,
  type = "button",
  ...rest
}: ActionButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...rest} />;
}
