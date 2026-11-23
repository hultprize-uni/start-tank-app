import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./landing.module.css";

export interface CtaLinkProps {
  /** Destino interno, ancla de la misma página o URL externa. */
  href: string;
  children: ReactNode;
  /** "primary" usa el acento; "ghost" es de contorno. Predeterminado: "primary". */
  variant?: "primary" | "ghost";
  className?: string;
}

/*
 * Enlace con apariencia de botón: el botón del kit es un elemento button y el CTA debe navegar.
 * Los destinos externos se abren en otra pestaña con rel="noopener noreferrer".
 */
export function CtaLink({ href, children, variant = "primary", className }: CtaLinkProps) {
  const classes = [styles.cta, variant === "primary" ? styles.ctaPrimary : styles.ctaGhost, className]
    .filter(Boolean)
    .join(" ");

  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
