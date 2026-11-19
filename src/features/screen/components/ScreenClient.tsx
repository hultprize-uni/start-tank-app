"use client";

import { useScreenState } from "../hooks/useScreenState";
import type { ScreenPhase, ScreenViewModel } from "../types";
import { phaseStatus, roundNumberOf, type PhaseStatus } from "./phases";
import { BetweenRoundsPhase } from "./BetweenRoundsPhase";
import { ClosingPhase } from "./ClosingPhase";
import { LastCallPhase } from "./LastCallPhase";
import { MarketPhase } from "./MarketPhase";
import { PhaseSelector } from "./PhaseSelector";
import { ScreenStage } from "./ScreenStage";
import { SettlementPhase } from "./SettlementPhase";
import { VotingPhase } from "./VotingPhase";
import { WaitingPhase } from "./WaitingPhase";
import styles from "./screen.module.css";

interface ScreenClientProps {
  /** Fase forzada por la query `fase`. El servidor la envia solo en desarrollo. */
  forcedPhase?: ScreenPhase;
  showSelector: boolean;
}

/** Estado mostrado mientras no existe ninguna lectura del servidor. */
const CONNECTING_STATUS: PhaseStatus = { label: "Conectando", tone: "neutral", live: true };

function renderPhase(vm: ScreenViewModel) {
  switch (vm.phase) {
    case "WAITING":
      return <WaitingPhase vm={vm} />;
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
export function ScreenClient({ forcedPhase, showSelector }: ScreenClientProps) {
  const { vm, offline } = useScreenState(forcedPhase);

  if (vm === null) {
    return (
      <ScreenStage status={CONNECTING_STATUS} offline={offline}>
        <p className={styles.lead}>Esperando datos del evento.</p>
      </ScreenStage>
    );
  }

  return (
    <>
      <ScreenStage
        status={phaseStatus(vm.phase)}
        roundNumber={roundNumberOf(vm)}
        offline={offline}
      >
        {renderPhase(vm)}
      </ScreenStage>
      {showSelector ? <PhaseSelector currentPhase={vm.phase} /> : null}
    </>
  );
}
