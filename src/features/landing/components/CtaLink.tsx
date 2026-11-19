import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./landing.module.css";

export interface CtaLinkProps {
  /** Destino interno (ruta de la aplicación) o ancla de la misma página. */
  href: string;
  /** Texto visible del enlace. */
  children: ReactNode;
  /** Estilo visual: "primary" usa el acento; "ghost" es de contorno. Predeterminado: "primary". */
  variant?: "primary" | "ghost";
  /** Clase adicional para ajustes de la sección que lo contiene. */
  className?: string;
}

/*
 * Enlace con apariencia de botón. Se crea localmente porque el botón del kit renderiza un elemento
 * button y el CTA debe navegar. Los destinos externos llevan rel="noopener noreferrer".
 */
export function CtaLink({ href, children, variant = "primary", className }: CtaLinkProps) {
  const classes = [styles.cta, styles[`cta${variant === "primary" ? "Primary" : "Ghost"}`], className]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
