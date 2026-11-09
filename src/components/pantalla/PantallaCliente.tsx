"use client";

import type { ScreenPhase, ScreenViewModel } from "@/lib/api/screen.types";
import { useScreenState } from "@/lib/api/screen.mock";
import { etiquetaFase } from "./fases";
import { FaseCierre } from "./FaseCierre";
import { FaseEntreRondas } from "./FaseEntreRondas";
import { FaseLiquidacion } from "./FaseLiquidacion";
import { FaseMercado } from "./FaseMercado";
import { FaseUltimaLlamada } from "./FaseUltimaLlamada";
import { FaseVotacion } from "./FaseVotacion";
import { PantallaEscenario } from "./PantallaEscenario";
import { SelectorFase } from "./SelectorFase";

interface PantallaClienteProps {
  /** Fase forzada por la query `fase`. El servidor la envia solo en desarrollo. */
  faseForzada?: ScreenPhase;
  mostrarSelector: boolean;
}

function renderizarFase(vm: ScreenViewModel) {
  switch (vm.fase) {
    case "MERCADO":
      return <FaseMercado vm={vm} />;
    case "ULTIMA_LLAMADA":
      return <FaseUltimaLlamada vm={vm} />;
    case "VOTACION":
      return <FaseVotacion vm={vm} />;
    case "LIQUIDACION":
      return <FaseLiquidacion vm={vm} />;
    case "ENTRE_RONDAS":
      return <FaseEntreRondas vm={vm} />;
    case "CIERRE":
      return <FaseCierre vm={vm} />;
  }
}

/** Vista de solo lectura de la pantalla. Lee el estado simulado y lo presenta por fase. */
export function PantallaCliente({ faseForzada, mostrarSelector }: PantallaClienteProps) {
  const vm = useScreenState(faseForzada);

  return (
    <>
      <PantallaEscenario etiquetaFase={etiquetaFase(vm.fase)}>{renderizarFase(vm)}</PantallaEscenario>
      {mostrarSelector ? <SelectorFase faseActual={vm.fase} /> : null}
    </>
  );
}
