import type { Metadata } from "next";
import { ScreenClient, parsePhase } from "@/features/screen";

/* Metadatos de la pantalla. No se indexa: es una vista operativa del evento. */
export const metadata: Metadata = {
  title: "Pantalla del evento | Start Tank",
  robots: { index: false, follow: false },
};

interface ScreenPageProps {
  searchParams: Promise<{ phase?: string | string[] }>;
}

/*
 * Página pública de solo lectura para el proyector. No requiere autenticación y no ejecuta
 * escrituras. El parámetro `phase` solo se atiende en desarrollo.
 */
export default async function ScreenPage({ searchParams }: ScreenPageProps) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const { phase } = await searchParams;
  const phaseValue = Array.isArray(phase) ? phase[0] : phase;

  return (
    <ScreenClient
      forcedPhase={isDevelopment ? parsePhase(phaseValue) : undefined}
      showSelector={isDevelopment}
    />
  );
}
