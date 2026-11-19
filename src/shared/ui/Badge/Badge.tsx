import type { ReactNode } from "react";
import { LiveDot } from "../LiveDot";
import styles from "./Badge.module.css";

export type BadgeTone = "cyan" | "pink" | "yellow" | "neutral";

export interface BadgeProps {
  /** Contenido de la etiqueta. Se pasa como texto o nodos; el componente no incluye textos fijos. */
  children: ReactNode;
  /** Tono de color. Predeterminado: "cyan". */
  tone?: BadgeTone;
  /** Muestra un punto pulsante antes del contenido para indicar un estado en vivo. */
  live?: boolean;
  className?: string;
}

/** Etiqueta compacta para estados, categorías y avisos breves. */
export function Badge({ children, tone = "cyan", live = false, className }: BadgeProps) {
  const classes = [styles.badge, styles[tone], className].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      {live ? <LiveDot /> : null}
      {children}
    </span>
  );
}
