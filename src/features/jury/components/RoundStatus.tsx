import { Badge } from "@/shared/ui";
import type { JuryPhase, JuryRoundView } from "../types";
import { PHASE_COPY } from "./copy";
import styles from "./RoundStatus.module.css";

interface RoundStatusProps {
  phase: JuryPhase;
  round: JuryRoundView | null;
}

/** Estado de la ronda vigente: etiqueta de fase y posición dentro del evento. */
export function RoundStatus({ phase, round }: RoundStatusProps) {
  const copy = PHASE_COPY[phase];

  return (
    <div className={styles.row}>
      <Badge tone={copy.tone} live={copy.live}>
        {copy.name}
      </Badge>
      {round !== null && (
        <span className={styles.position}>
          Ronda {round.number} de {round.total}
        </span>
      )}
    </div>
  );
}
