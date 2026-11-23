"use client";

import { useEffect, useRef } from "react";

/**
 * Ejecuta la tarea al montar y luego cada intervalo, sin solapar ejecuciones. Se detiene con la
 * pestaña oculta y consulta de inmediato al volver, para no gastar batería ni consultas.
 */
export function usePolling(task: () => Promise<void> | void, intervalMs: number, enabled = true): void {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return;
    let running = false;

    const tick = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        await taskRef.current();
      } finally {
        running = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled]);
}
