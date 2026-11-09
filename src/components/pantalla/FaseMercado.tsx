import type { MercadoAbierto } from "@/lib/api/screen.types";
import { CabeceraRonda } from "./CabeceraRonda";
import { MetricasMercado } from "./MetricasMercado";

interface FaseMercadoProps {
  vm: MercadoAbierto;
}

/** Fase Mercado abierto: startup, ODS, precio en vivo, monto acumulado e inversores unicos. */
export function FaseMercado({ vm }: FaseMercadoProps) {
  return (
    <>
      <CabeceraRonda ronda={vm.ronda} />
      <MetricasMercado
        precio={vm.precio}
        acumulado={vm.acumulado}
        inversoresUnicos={vm.inversoresUnicos}
      />
    </>
  );
}
