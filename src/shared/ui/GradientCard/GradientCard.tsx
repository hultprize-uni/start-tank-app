import type { ReactNode } from "react";
import styles from "./GradientCard.module.css";

export interface GradientCardProps {
  /** Contenido del panel interior. */
  children: ReactNode;
  /** Elemento HTML del contenedor exterior. Predeterminado: "div". */
  as?: "div" | "section" | "article";
  /** Añade el resplandor del acento bajo el marco. */
  glow?: boolean;
  /** Clase adicional para el marco degradado. */
  className?: string;
  /** Clase adicional para el panel interior. */
  panelClassName?: string;
}

/**
 * Tarjeta con marco de degradado de marca y panel interior oscuro.
 * Usa radios asimétricos en forma de hoja, definidos en los tokens --r-frame y --r-panel.
 */
export function GradientCard({
  children,
  as: Tag = "div",
  glow = false,
  className,
  panelClassName,
}: GradientCardProps) {
  const frameClasses = [styles.frame, glow ? styles.glow : null, className]
    .filter(Boolean)
    .join(" ");
  const panelClasses = [styles.panel, panelClassName].filter(Boolean).join(" ");

  return (
    <Tag className={frameClasses}>
      <div className={panelClasses}>{children}</div>
    </Tag>
  );
}
