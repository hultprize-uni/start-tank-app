import Image from "next/image";
import styles from "./BrandLogo.module.css";

export type BrandLogoVariant = "horizontal" | "vertical";

export interface BrandLogoProps {
  /** Versión del logotipo. Predeterminado: "horizontal". */
  variant?: BrandLogoVariant;
  /** Texto alternativo. Predeterminado: nombre de la marca. */
  alt?: string;
  /** Carga la imagen con prioridad; usar solo para el logotipo visible al abrir la página. */
  priority?: boolean;
  className?: string;
}

/** Dimensiones intrínsecas de cada archivo en public/brand, usadas para reservar el espacio. */
const LOGOS: Record<BrandLogoVariant, { src: string; width: number; height: number }> = {
  horizontal: { src: "/brand/logo-start-tank-horizontal.png", width: 800, height: 231 },
  vertical: { src: "/brand/logo-start-tank-vertical.png", width: 480, height: 451 },
};

/** Logotipo de Start Tank, servido con next/image desde public/brand. */
export function BrandLogo({
  variant = "horizontal",
  alt = "Start Tank",
  priority = false,
  className,
}: BrandLogoProps) {
  const logo = LOGOS[variant];
  const classes = [styles.logo, styles[variant], className].filter(Boolean).join(" ");

  return (
    <Image
      src={logo.src}
      alt={alt}
      width={logo.width}
      height={logo.height}
      priority={priority}
      className={classes}
    />
  );
}
