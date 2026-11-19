import type { ReactNode } from "react";
import styles from "./Eyebrow.module.css";

export type EyebrowTone = "cyan" | "pink" | "yellow" | "muted";

export interface EyebrowProps {
  /** Texto corto que antecede a un título. Se muestra en mayúsculas mediante CSS. */
  children: ReactNode;
  /** Color del texto. Predeterminado: "cyan". */
  tone?: EyebrowTone;
  /** Elemento HTML que se renderiza. Predeterminado: "p". */
  as?: "p" | "span" | "div";
  className?: string;
}

/** Rótulo pequeño en mayúsculas espaciadas, usado sobre títulos de sección. */
export function Eyebrow({ children, tone = "cyan", as: Tag = "p", className }: EyebrowProps) {
  const classes = [styles.eyebrow, styles[tone], className].filter(Boolean).join(" ");

  return <Tag className={classes}>{children}</Tag>;
}
