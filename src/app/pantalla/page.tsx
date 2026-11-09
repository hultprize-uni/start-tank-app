import { PantallaCliente } from "@/components/pantalla/PantallaCliente";
import { parsearFase } from "@/components/pantalla/fases";

interface PaginaPantallaProps {
  searchParams: Promise<{ fase?: string | string[] }>;
}

/*
 * Pagina publica de solo lectura para el proyector. No requiere autenticacion
 * y no ejecuta escrituras. El parametro `fase` solo se atiende en desarrollo.
 */
export default async function PaginaPantalla({ searchParams }: PaginaPantallaProps) {
  const esDesarrollo = process.env.NODE_ENV === "development";
  const { fase } = await searchParams;
  const valorFase = Array.isArray(fase) ? fase[0] : fase;

  return (
    <PantallaCliente
      faseForzada={esDesarrollo ? parsearFase(valorFase) : undefined}
      mostrarSelector={esDesarrollo}
    />
  );
}
