"use client";

import { useEffect, useState } from "react";
import type { PhaseClock } from "@/shared/domain/types";

/*
 * Reloj del servidor en el cliente (RNF-15). Cada respuesta de estado trae serverTime; con él se
 * calcula el desfase entre el reloj del teléfono y el del servidor, y todos los cronómetros cuentan
 * con la hora del servidor. Hay un solo servidor, así que basta un desfase por pestaña.
 */

let offsetMs = 0;

/** Registra la hora del servidor recibida en una respuesta. */
export function syncServerClock(serverTime: string, receivedAt: number = Date.now()): void {
  const server = Date.parse(serverTime);
  if (Number.isFinite(server)) {
    offsetMs = server - receivedAt;
  }
}

/** Hora actual del servidor en milisegundos, estimada con el último desfase. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Segundos enteros que faltan para una hora ISO, nunca negativos. Nulo sin hora. */
export function secondsUntil(iso: string | null, now: number = serverNow()): number | null {
  if (iso === null) return null;
  const target = Date.parse(iso);
  return Number.isFinite(target) ? Math.max(0, Math.ceil((target - now) / 1000)) : null;
}

/** Segundos restantes de la fase: los congelados si está en pausa, o hasta phaseEndsAt. */
export function phaseSecondsLeft(clock: PhaseClock | null, now: number = serverNow()): number | null {
  if (clock === null) return null;
  if (clock.paused) return clock.pausedSeconds;
  return secondsUntil(clock.phaseEndsAt, now);
}

/** Hora del servidor que se actualiza cada intervalo, para cronómetros en pantalla. */
export function useServerNow(intervalMs = 250): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Segundos restantes de la fase, actualizados cada cuarto de segundo. */
export function usePhaseSeconds(clock: PhaseClock | null): number | null {
  return phaseSecondsLeft(clock, useServerNow());
}
