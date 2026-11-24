"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { DB_LATENCY_CRITICAL_MS } from "../thresholds";
import type { HealthView } from "../types";

import panel from "./Panel.module.css";
import styles from "./Admin.module.css";

/** Puntos guardados de la latencia: 10 minutos con una consulta cada 3 segundos. */
const LATENCY_POINTS = 200;

interface HealthSectionProps {
  health: HealthView | null;
  /** Modo manual y alertas: se componen desde el portal. */
  children: ReactNode;
}

/** Línea de latencia de los últimos 10 minutos, con el umbral de 1 s punteado. */
function LatencySparkline({ points }: { points: readonly number[] }) {
  const width = 300;
  const height = 80;
  const max = Math.max(DB_LATENCY_CRITICAL_MS * 1.2, ...points);
  const x = (index: number) =>
    points.length <= 1 ? width : (index / (points.length - 1)) * width;
  const y = (value: number) => height - (value / max) * height;
  const path = points.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`).join(" ");
  const limit = y(DB_LATENCY_CRITICAL_MS);
  return (
    <svg
      className={styles.sparkline}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={
        points.length === 0
          ? "Sin datos de latencia todavía"
          : `Latencia actual ${points[points.length - 1]} ms; umbral 1 s`
      }
    >
      <line className={styles.sparklineLimit} x1={0} x2={width} y1={limit} y2={limit} />
      {points.length > 0 ? <path className={styles.sparklineLine} d={path} /> : null}
    </svg>
  );
}

/**
 * Salud y alertas (CU-18): detalle del semáforo, latencia de los últimos 10 minutos (medida en esta
 * laptop mientras la consola está abierta) y el modo manual.
 */
export function HealthSection({ health, children }: HealthSectionProps) {
  const [points, setPoints] = useState<number[]>([]);
  const lastTime = useRef<string | null>(null);

  useEffect(() => {
    if (health === null || health.serverTime === lastTime.current) return;
    lastTime.current = health.serverTime;
    setPoints((current) => [...current, health.dbLatencyMs].slice(-LATENCY_POINTS));
  }, [health]);

  return (
    <>
      <h1 className={styles.sectionTitle}>Salud y alertas</h1>
      <div className={styles.twoColumns}>
        {children}
        <section className={panel.panel} aria-labelledby="latencia">
          <h2 id="latencia" className={panel.title}>
            Latencia de consultas
          </h2>
          <LatencySparkline points={points} />
          <p className={panel.note}>Umbral 1 s (línea punteada). Últimos 10 minutos.</p>
          {health !== null ? (
            <dl className={styles.kv}>
              {health.signals.map((signal) => (
                <div key={signal.id} style={{ display: "contents" }}>
                  <dt>{signal.label}</dt>
                  <dd>{signal.value}</dd>
                </div>
              ))}
              <dt>Teléfonos conectados</dt>
              <dd>
                {health.attendeesOnline} de {health.attendeesTotal}
              </dd>
            </dl>
          ) : null}
        </section>
      </div>
    </>
  );
}
