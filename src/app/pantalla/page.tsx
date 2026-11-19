import { ScreenClient } from "@/features/screen/components/ScreenClient";
import { parsePhase } from "@/features/screen/components/phases";

interface ScreenPageProps {
  searchParams: Promise<{ phase?: string | string[] }>;
}

/*
 * Pagina publica de solo lectura para el proyector. No requiere autenticacion
 * y no ejecuta escrituras. El parametro `fase` solo se atiende en desarrollo.
 */
export default async function ScreenPage({ searchParams }: ScreenPageProps) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const { phase: phase } = await searchParams;
  const phaseValue = Array.isArray(phase) ? phase[0] : phase;

  return (
    <ScreenClient
      forcedPhase={isDevelopment ? parsePhase(phaseValue) : undefined}
      showSelector={isDevelopment}
    />
  );
}
