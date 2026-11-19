"use client";

import { useCallback, useEffect, useState } from "react";
import type { ToastTone } from "@/shared/ui";

/** Tiempo que el aviso permanece visible, en milisegundos. */
export const TOAST_DURATION_MS = 2_600;

/** Aviso activo del portal: texto y tono. */
export interface PortalToast {
  message: string;
  tone: ToastTone;
}

/** Aviso breve del portal que se retira solo al cabo de un tiempo. */
export function usePortalToast(durationMs: number = TOAST_DURATION_MS): {
  toast: PortalToast | null;
  showToast: (message: string, tone?: ToastTone) => void;
} {
  const [toast, setToast] = useState<PortalToast | null>(null);

  useEffect(() => {
    if (toast === null) return;
    const timer = window.setTimeout(() => setToast(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, durationMs]);

  const showToast = useCallback((message: string, tone: ToastTone = "neutral") => {
    setToast({ message, tone });
  }, []);

  return { toast, showToast };
}
