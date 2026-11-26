import type { Metadata } from "next";
import { ScreenClient } from "@/features/screen";

/* Metadatos de la pantalla. No se indexa: es una vista operativa del evento. */
export const metadata: Metadata = {
  title: "Pantalla del evento | Start Tank",
  robots: { index: false, follow: false },
};

/*
 * Página pública de solo lectura para el proyector. No requiere autenticación y no ejecuta
 * escrituras: siempre muestra el estado real del evento, también en desarrollo.
 */
export default function ScreenPage() {
  return <ScreenClient />;
}
