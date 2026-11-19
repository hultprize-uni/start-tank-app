import { Badge, ProgressBar } from "@/shared/ui";
import type { Decision } from "@/shared/domain/types";
import type { JuryVotesView } from "../types";
import { DECISION_COPY } from "./copy";
import styles from "./VoteRegistered.module.css";

interface VoteRegisteredProps {
  ownVote: Decision;
  votes: JuryVotesView;
}

/** Confirmación del voto emitido, con el avance de votos de la ronda. */
export function VoteRegistered({ ownVote, votes }: VoteRegisteredProps) {
  const countText = `${votes.emitted} de ${votes.total} votos emitidos`;

  return (
    <section className={styles.panel} aria-labelledby="registrado-titulo">
      <Badge tone="cyan">Voto registrado</Badge>
      <h2 id="registrado-titulo" className={styles.decision}>
        {DECISION_COPY[ownVote].choice}
      </h2>
      <p className={styles.lead}>
        Los {votes.total} votos se publican a la vez cuando el operador revele el veredicto.
      </p>

      <ProgressBar
        label="Votos emitidos"
        value={votes.emitted}
        max={votes.total}
        valueText={countText}
        tone="cyan"
      />
      <p className={styles.count} aria-live="polite">
        {countText}
      </p>
    </section>
  );
}
