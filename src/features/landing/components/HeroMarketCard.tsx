"use client";

import { useEffect, useState } from "react";
import { Badge, GradientCard, LiveDot, StatBlock } from "@/shared/ui";
import { usePrefersReducedMotion } from "@/shared/lib/use-prefers-reduced-motion";
import { DEMO_STARTUPS, marketFrame } from "./market-demo";
import styles from "./landing.module.css";

/** Intervalo de avance de la serie de precio, en milisegundos. */
const TICK_MS = 1200;
/** Intervalo de cambio de startup, en milisegundos. */
const STARTUP_MS = 9600;

interface DemoState {
  tick: number;
  index: number;
}

/*
 * Tarjeta de mercado de la portada. Muestra una simulación con datos de muestra. Con movimiento
 * reducido, la tarjeta permanece en su primer cuadro. No consulta la API ni escribe datos.
 */
export function HeroMarketCard() {
  const reducedMotion = usePrefersReducedMotion();
  const [demo, setDemo] = useState<DemoState>({ tick: 0, index: 2 });

  useEffect(() => {
    if (reducedMotion) return;
    const frameId = setInterval(() => {
      setDemo((current) => ({ ...current, tick: current.tick + 1 }));
    }, TICK_MS);
    const startupId = setInterval(() => {
      setDemo((current) => ({
        tick: 0,
        index: (current.index + 1) % DEMO_STARTUPS.length,
      }));
    }, STARTUP_MS);
    return () => {
      clearInterval(frameId);
      clearInterval(startupId);
    };
  }, [reducedMotion]);

  const startup = DEMO_STARTUPS[demo.index];
  const frame = marketFrame(demo.tick, demo.index);

  return (
    <GradientCard glow className={styles.heroFrame} panelClassName={styles.heroPanel}>
      <div className={styles.heroTop}>
        <span className={styles.heroLive}>
          <LiveDot tone="cyan" />
          Mercado en vivo
        </span>
        <span className={styles.heroRound}>Ronda 3 de 5</span>
      </div>
      <p className={styles.heroStartup}>{startup.name}</p>
      <p className={styles.heroOds}>{startup.ods}</p>
      <div className={styles.heroPriceRow}>
        <p className={styles.heroPrice}>{frame.price}</p>
        <Badge tone="cyan">{frame.delta}</Badge>
      </div>
      <svg
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        className={styles.sparkline}
        aria-hidden="true"
        focusable="false"
      >
        <polyline points={frame.points} />
      </svg>
      <div className={styles.heroStats}>
        <StatBlock label="Acumulado" value={`${frame.accumulated} IC`} size="md" />
        <StatBlock label="Inversores" value={frame.investors} size="md" />
      </div>
    </GradientCard>
  );
}
