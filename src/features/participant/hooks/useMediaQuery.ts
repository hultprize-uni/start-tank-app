"use client";

import { useSyncExternalStore } from "react";

/** Consulta de escritorio: a partir de este ancho se muestra el diseño de dos columnas. */
export const DESKTOP_QUERY = "(min-width: 820px)";

/** Sin soporte de matchMedia, el diseño se considera móvil. */
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

/**
 * Indica si una consulta de medios coincide y se actualiza al cambiar el ancho de la ventana. En el
 * servidor devuelve false, de modo que el primer render usa el diseño móvil.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeTo(query, onChange),
    () => matches(query),
    () => false,
  );
}
