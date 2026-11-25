import { StartTankLoader } from "@/shared/ui";

/* Carga de cualquier ruta mientras el servidor prepara la página. */
export default function Loading() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", background: "var(--bg-page)" }}>
      <StartTankLoader label="Cargando..." />
    </main>
  );
}
