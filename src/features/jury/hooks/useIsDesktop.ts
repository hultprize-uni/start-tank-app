"use client";

import { useSyncExternalStore } from "react";

const DESKTOP_QUERY = "(min-width: 820px)";

function subscribeTo(query: string, onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function matches(query: string): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query).matches;
}

/** Indica si el ancho actual corresponde a escritorio/laptop (>= 820 px). */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeTo(DESKTOP_QUERY, onChange),
    () => matches(DESKTOP_QUERY),
    () => false,
  );
}
