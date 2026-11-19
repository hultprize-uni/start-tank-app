"use client";

import type { CSSProperties } from "react";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import styles from "./AnimatedBackground.module.css";

export interface AnimatedBackgroundProps {
  /** Posiciona el fondo respecto a la ventana (true) o a su contenedor (false). Predeterminado: true. */
  fixed?: boolean;
  className?: string;
}

/** Posiciones, tamaños y tiempos de las burbujas. Valores fijos para que el render sea estable. */
const BUBBLES: CSSProperties[] = [
  { left: "4%", width: 10, height: 10, animationDuration: "16s", animationDelay: "0s" },
  { left: "14%", width: 16, height: 16, animationDuration: "22s", animationDelay: "-6s" },
  { left: "26%", width: 8, height: 8, animationDuration: "13s", animationDelay: "-3s" },
  { left: "38%", width: 22, height: 22, animationDuration: "19s", animationDelay: "-11s" },
  { left: "50%", width: 12, height: 12, animationDuration: "25s", animationDelay: "-8s" },
  { left: "61%", width: 18, height: 18, animationDuration: "15s", animationDelay: "-15s" },
  { left: "72%", width: 9, height: 9, animationDuration: "21s", animationDelay: "-2s" },
  { left: "83%", width: 14, height: 14, animationDuration: "17s", animationDelay: "-9s" },
  { left: "91%", width: 20, height: 20, animationDuration: "24s", animationDelay: "-13s" },
  { left: "22%", width: 11, height: 11, animationDuration: "12s", animationDelay: "-18s" },
];

/** Silueta simplificada de tiburón; se oculta de las tecnologías de apoyo junto con el fondo. */
function SharkSilhouette() {
  return (
    <svg viewBox="0 0 400 160" focusable="false" aria-hidden="true">
      <path d="M372 84 C340 74 300 66 262 58 L226 16 C218 42 210 52 192 56 C150 64 100 68 62 74 L12 30 C18 58 22 74 30 84 C22 96 18 112 12 136 L62 96 C110 110 170 116 230 110 C290 104 340 98 372 84 Z" />
      <path d="M240 104 L214 142 L200 106 Z" />
    </svg>
  );
}

/**
 * Fondo decorativo con tiburones, burbujas y resplandores de marca.
 * Está oculto de las tecnologías de apoyo. Con movimiento reducido, las animaciones se detienen
 * y las burbujas no se renderizan.
 */
export function AnimatedBackground({ fixed = true, className }: AnimatedBackgroundProps) {
  const reducedMotion = usePrefersReducedMotion();
  const classes = [styles.background, fixed ? styles.fixed : styles.absolute, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      aria-hidden="true"
      data-reduced-motion={reducedMotion ? "true" : undefined}
    >
      <div className={`${styles.glow} ${styles.glowCyan}`} />
      <div className={`${styles.glow} ${styles.glowPink}`} />

      <div className={`${styles.shark} ${styles.sharkLarge}`}>
        <div className={styles.bob}>
          <SharkSilhouette />
        </div>
      </div>
      <div className={`${styles.shark} ${styles.sharkSmall}`}>
        <div className={`${styles.bob} ${styles.bobSlow}`}>
          <SharkSilhouette />
        </div>
      </div>

      {reducedMotion
        ? null
        : BUBBLES.map((bubble, index) => (
            <i key={index} className={styles.bubble} style={bubble} />
          ))}
    </div>
  );
}
