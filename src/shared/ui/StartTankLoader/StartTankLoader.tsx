"use client";

import { useId } from "react";
import styles from "./StartTankLoader.module.css";

export interface StartTankLoaderProps {
  /** Texto visible y anunciado bajo la animación. Sin valor, el loader es decorativo. */
  label?: string;
  /** Repite la animación mientras dure la carga. Con false se reproduce una vez. Predeterminado: true. */
  loop?: boolean;
  className?: string;
}

/*
 * Loader de marca: el cohete despega desde abajo y, a su paso, pinta las letras del logotipo;
 * luego un tiburón muerde la K (por eso el logo final trae las mordidas). Las dos versiones del
 * logo (K entera y K mordida) se cruzan en el instante de la mordida. Con movimiento reducido se
 * muestra el logo final quieto.
 */
export function StartTankLoader({ label, loop = true, className }: StartTankLoaderProps) {
  const id = useId();
  const bodyGradient = `${id}-body`;
  const flameGradient = `${id}-flame`;
  const sharkGradient = `${id}-shark`;
  const classes = [styles.loader, loop ? styles.loop : styles.once, className].filter(Boolean).join(" ");

  const stage = (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.logoWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element -- recorte animado con clip-path, sin optimización */}
        <img src="/brand/logo-start-tank-vertical-entero.png" alt="" className={styles.logoWhole} width={480} height={451} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-start-tank-vertical.png" alt="" className={styles.logoBitten} width={480} height={451} />
      </div>

      <svg className={styles.rocket} viewBox="0 0 40 96" focusable="false">
        <defs>
          <linearGradient id={bodyGradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#12B1E7" />
            <stop offset="1" stopColor="#5B33B8" />
          </linearGradient>
          <linearGradient id={flameGradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F356A6" />
            <stop offset="1" stopColor="#F356A6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className={styles.flame} d="M12 62 Q20 96 28 62 Z" fill={`url(#${flameGradient})`} />
        <path d="M9 46 L1 64 L13 60 Z M31 46 L39 64 L27 60 Z" fill="#8A2890" />
        <path d="M20 2 C31 13 33 34 30 62 L10 62 C7 34 9 13 20 2 Z" fill={`url(#${bodyGradient})`} />
        <circle cx="20" cy="29" r="5.5" fill="#0B0714" stroke="#FFFFFF" strokeWidth="2.4" />
      </svg>

      <svg className={styles.shark} viewBox="0 0 124 64" focusable="false">
        <defs>
          <linearGradient id={sharkGradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C9C5E8" />
            <stop offset="1" stopColor="#7E78AE" />
          </linearGradient>
        </defs>
        <g className={styles.jaw}>
          <path d="M8 40 L34 41 C35 47 30 52 21 52 C13 52 9 47 8 40 Z" fill="#7E78AE" />
          <path d="M11 41 l2.5 -4 l2.5 4 M18 41.3 l2.5 -4 l2.5 4 M25 41.6 l2.5 -4 l2.5 4" fill="#FFFFFF" />
        </g>
        <path
          d="M4 32 C14 20 36 13 58 14 L68 0 L75 16 C92 19 104 25 110 30 L122 15 L118 38 L122 60 L108 45 C92 52 66 55 44 50 C39 48 36 44 34 40 L8 38 Z"
          fill={`url(#${sharkGradient})`}
        />
        <path d="M10 38 l2.5 5 l2.5 -5 M17 38.4 l2.5 5 l2.5 -5 M24 38.8 l2.5 5 l2.5 -5" fill="#FFFFFF" />
        <circle cx="23" cy="27" r="2.4" fill="#0B0714" />
        <path d="M44 28 q-2 6 0 12 M49 27 q-2 7 0 14" stroke="#7E78AE" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );

  if (!label) {
    return <div className={classes}>{stage}</div>;
  }

  return (
    <div className={classes} role="status">
      {stage}
      <p className={styles.label}>{label}</p>
    </div>
  );
}
