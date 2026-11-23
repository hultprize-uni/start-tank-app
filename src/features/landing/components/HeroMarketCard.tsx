"use client";

import { useEffect, useState } from "react";
import { GradientCard, LiveDot } from "@/shared/ui";
import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";
import { marketFrame } from "./market-demo";
import styles from "./landing.module.css";

/** Una inversión simulada cada 1.4 segundos. */
const TICK_MS = 1400;

/*
 * Demo de mercado en vivo de la portada (Figma: "Demo de mercado en vivo"): precio, curva
 * escalonada que sube con cada inversión y cinta de startups. Datos de muestra; no consulta la API.
 * Con movimiento reducido queda fija en su primer cuadro.
 */
export function HeroMarketCard() {
  const reducedMotion = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setTick((current) => current + 1), TICK_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const frame = marketFrame(tick);

  return (
    <GradientCard glow className={styles.demoFrame} panelClassName={styles.demoPanel}>
      <div className={styles.demoTop}>
        <span className={styles.demoLive}>
          <LiveDot tone="cyan" />
          En vivo
        </span>
        <span className={styles.demoRound}>Ronda 2 de 5</span>
      </div>

      <div className={styles.demoStartup}>
        <span className={styles.demoLogo} aria-hidden="true">
          AC
        </span>
        <div>
          <p className={styles.demoName}>AguaClara</p>
          <p className={styles.demoOds}>ODS 6: Agua limpia</p>
        </div>
      </div>

      <div className={styles.demoPriceRow} aria-label={`Precio en vivo ${frame.price}`}>
        <p key={frame.price} className={styles.demoPrice}>
          {frame.price}
        </p>
        <p className={styles.demoDelta}>{frame.delta}</p>
      </div>

      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={styles.demoCurve} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="demo-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--st-cyan)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--st-cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={frame.area} fill="url(#demo-fill)" />
        <polyline points={frame.line} />
      </svg>

      <ul className={styles.demoTape} aria-label="Startups de la noche">
        <li className={styles.tapeChip}>
          AgroSense <span className={styles.tapeUp}>▲ 1.4x</span>
        </li>
        <li className={styles.tapeChip}>
          AguaClara <span className={styles.tapeLive}>● en escena</span>
        </li>
      </ul>
    </GradientCard>
  );
}
