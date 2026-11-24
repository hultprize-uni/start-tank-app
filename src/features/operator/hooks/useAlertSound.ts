"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { playAlertTone, readMuted, writeMuted } from "../lib/alert-sound";
import type { HealthAlert } from "../types";

export interface AlertSoundState {
  muted: boolean;
  toggleMuted: () => void;
}

/**
 * Suena una sola vez por cada alerta crítica nueva (tarea 5.9). Las alertas ámbar no suenan, y una
 * alerta que sigue activa no vuelve a sonar en cada consulta.
 */
export function useAlertSound(
  alerts: readonly HealthAlert[],
  play: () => void = playAlertTone,
): AlertSoundState {
  const [muted, setMuted] = useState(false);
  const heard = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMuted(readMuted());
  }, []);

  useEffect(() => {
    const critical = alerts.filter((alert) => alert.level === "critical").map((alert) => alert.id);
    const fresh = critical.filter((id) => !heard.current.has(id));
    // Las alertas resueltas se olvidan, para que vuelvan a sonar si reaparecen.
    heard.current = new Set(critical);
    if (fresh.length > 0 && !muted) play();
  }, [alerts, muted, play]);

  const toggleMuted = useCallback(() => {
    setMuted((value) => {
      writeMuted(!value);
      return !value;
    });
  }, []);

  return { muted, toggleMuted };
}
