"use client";

import type { PhaseClock } from "@/shared/domain/types";
import { usePhaseSeconds } from "@/shared/lib/use-server-clock";
import { Badge, Countdown } from "@/shared/ui";
import type { JuryPhase, JuryRoundView } from "../types";
import { PHASE_COPY } from "./copy";
import styles from "./RoundStatus.module.css";

interface RoundStatusProps {
  phase: JuryPhase;
  round: JuryRoundView | null;
  clock: PhaseClock | null;
}

/**
 * Barra superior de fase vigente (RF-07, RNF-15): muestra el estado de la ronda, la startup en
 * escena, la posición en el evento y el cronómetro sincronizado con la hora del servidor.
 */
export function RoundStatus({ phase, round, clock }: RoundStatusProps) {
  const copy = PHASE_COPY[phase];
  const seconds = usePhaseSeconds(clock);
  const paused = clock?.paused ?? false;
  const isWarning = !paused && seconds !== null && (phase === "last_call" || seconds <= 30);

  return (
    <div className={styles.bar} role="region" aria-label="Estado de la ronda">
      <div className={styles.badges}>
        <Badge tone={copy.tone} live={copy.live && !paused}>
          {copy.name}
        </Badge>
        {paused && <Badge tone="yellow">En pausa</Badge>}
      </div>

      {round !== null && (
        <div className={styles.scene}>
          <span className={styles.startup}>{round.startupName}</span>
          <span className={styles.position}>
            Ronda {round.number} de {round.total}
          </span>
        </div>
      )}

      {seconds !== null && (
        <div className={styles.timer}>
          <Countdown
            seconds={seconds}
            label="Tiempo restante de la fase"
            tone={isWarning ? "warning" : "default"}
            className={styles.countdown}
          />
          {paused && <span className={styles.pausedHint}>Pausado</span>}
        </div>
      )}
    </div>
  );
}
