import { formatJuryScore, formatMultiplier } from "../labels";
import type { StandingView } from "../types";

import panel from "./Panel.module.css";

interface StandingsPanelProps {
  /** Startups liquidadas, de mayor a menor puntaje del jurado. */
  standings: readonly StandingView[];
}

/**
 * Startups liquidadas con su puntaje del jurado y su multiplicador. El puntaje final 60/40 y la
 * ganadora se calculan al cerrar el evento (RF-30).
 */
export function StandingsPanel({ standings }: StandingsPanelProps) {
  if (standings.length === 0) {
    return null;
  }

  return (
    <section className={panel.panel} aria-labelledby="startups-liquidadas">
      <div className={panel.header}>
        <h2 id="startups-liquidadas" className={panel.title}>
          Startups hasta ahora
        </h2>
      </div>
      <ol className={panel.list}>
        {standings.map((standing, index) => (
          <li key={standing.roundNumber} className={panel.standingRow}>
            <span className={panel.muted}>{index + 1}</span>
            <span>
              {standing.startupName}{" "}
              <span className={panel.muted}>{formatJuryScore(standing.juryScore)} de 5</span>
            </span>
            <span className={panel.standingScore}>
              {standing.multiplier === null ? "—" : formatMultiplier(standing.multiplier)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
