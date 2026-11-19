"use client";

import { useScreenState } from "@/lib/api/screen.client";
import type { ScreenPhase, ScreenViewModel } from "@/lib/api/screen.types";
import { phaseLabel } from "./fases";
import { ClosingPhase } from "./FaseCierre";
import { BetweenRoundsPhase } from "./FaseEntreRondas";
import { SettlementPhase } from "./FaseLiquidacion";
import { MarketPhase } from "./FaseMercado";
import { LastCallPhase } from "./FaseUltimaLlamada";
import { VotingPhase } from "./FaseVotacion";
import { ScreenStage } from "./PantallaEscenario";
import { PhaseSelector } from "./SelectorFase";
import styles from "./pantalla.module.css";

interface ScreenClientProps {
  /** Fase forzada por la query `fase`. El servidor la envia solo en desarrollo. */
  forcedPhase?: ScreenPhase;
  showSelector: boolean;
}

function renderPhase(vm: ScreenViewModel) {
  switch (vm.phase) {
    case "MARKET":
      return <MarketPhase vm={vm} />;
    case "LAST_CALL":
      return <LastCallPhase vm={vm} />;
    case "VOTING":
      return <VotingPhase vm={vm} />;
    case "SETTLEMENT":
      return <SettlementPhase vm={vm} />;
    case "BETWEEN_ROUNDS":
      return <BetweenRoundsPhase vm={vm} />;
    case "CLOSING":
      return <ClosingPhase vm={vm} />;
  }
}

/** Vista de solo lectura de la pantalla. Consulta el estado del evento y lo presenta por fase. */
export function ScreenClient({ forcedPhase: forcedPhase, showSelector: showSelector }: ScreenClientProps) {
  const { vm, offline: offline } = useScreenState(forcedPhase);

  if (vm === null) {
    return (
      <ScreenStage phaseLabel="En espera">
        <p className={styles.subtitle}>Esperando datos del evento.</p>
      </ScreenStage>
    );
  }

  return (
    <>
      <ScreenStage phaseLabel={phaseLabel(vm.phase)}>
        {renderPhase(vm)}
        {offline ? (
          <p className={styles.subtitle}>Sin conexión. Se muestra la última lectura.</p>
        ) : null}
      </ScreenStage>
      {showSelector ? <PhaseSelector currentPhase={vm.phase} /> : null}
    </>
  );
}
