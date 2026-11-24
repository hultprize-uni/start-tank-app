"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { usePolling } from "@/shared/lib/use-polling";
import { useServerNow } from "@/shared/lib/use-server-clock";

import { readHealth } from "../api/client";
import { connectionAlert } from "../health";
import { HEALTH_POLL_MS } from "../thresholds";
import type { HealthAlert, HealthView } from "../types";

export interface HealthState {
  health: HealthView | null;
  /** Alertas del servidor más la de conexión perdida, con las críticas primero. */
  alerts: HealthAlert[];
}

interface HealthOptions {
  /** Hora local (ms) de la última respuesta correcta del estado de la consola. */
  lastOkAt: number;
  onSessionExpired?: () => void;
}

/**
 * Semáforo y alertas (RF-26). Consulta la salud cada 3 segundos y agrega la alerta de conexión
 * perdida, que solo el navegador detecta: si la consola deja de recibir datos, sugiere el modo
 * manual a los 90 s (RF-27).
 */
export function useHealth({ lastOkAt, onSessionExpired }: HealthOptions): HealthState {
  const [health, setHealth] = useState<HealthView | null>(null);
  const onExpiredRef = useRef(onSessionExpired);
  onExpiredRef.current = onSessionExpired;
  // Se actualiza cada segundo para que la alerta de conexión cuente los segundos.
  const now = useServerNow(1_000);

  const refresh = useCallback(async () => {
    const result = await readHealth();
    if (result.ok) {
      setHealth(result.value);
    } else if (result.sessionExpired) {
      onExpiredRef.current?.();
    }
  }, []);

  usePolling(refresh, HEALTH_POLL_MS);

  const alerts = useMemo(() => {
    const list = [...(health?.alerts ?? [])];
    const connection = connectionAlert(Math.max(0, (Date.now() - lastOkAt) / 1000));
    if (connection !== null) list.unshift(connection);
    return list;
    // now fuerza el recálculo de la alerta de conexión cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health, lastOkAt, now]);

  return { health, alerts };
}
