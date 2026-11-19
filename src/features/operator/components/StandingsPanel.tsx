import { formatScore } from "../labels";
import type { StandingView } from "../types";

import panel from "./Panel.module.css";

interface StandingsPanelProps {
  /** Puntajes de las startups liquidadas, de mayor a menor. */
  standings: StandingView[];
}

/** Puntaje por startup. La primera posición se resalta. No se muestra mientras no haya puntajes. */
export function StandingsPanel({ standings }: StandingsPanelProps) {
  if (standings.length === 0) {
    return null;
  }

  return (
    <section className={panel.panel} aria-labelledby="puntaje-startup">
      <div className={panel.header}>
        <h2 id="puntaje-startup" className={panel.title}>
          Puntaje por startup
        </h2>
      </div>
      <ol className={panel.list}>
        {standings.map((standing, index) => {
          const leader = index === 0;
          return (
            <li key={standing.roundNumber} className={panel.standingRow}>
              <span className={panel.muted}>{index + 1}</span>
              <span className={leader ? panel.standingWinner : undefined}>
                {standing.startupName}
              </span>
              <span className={panel.standingScore}>{formatScore(standing.score)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
