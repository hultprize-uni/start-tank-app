import type { JuryRoundView, JuryVotesView } from "@/lib/api/jury.types";
import styles from "./VoteRegistered.module.css";

interface VoteRegisteredProps {
  round: JuryRoundView;
  votes: JuryVotesView;
}

/** Confirmación de voto emitido, con el avance de votos de la ronda. */
export function VoteRegistered({ round, votes }: VoteRegisteredProps) {
  return (
    <section className={styles.panel} aria-labelledby="registrado-titulo">
      <p className={styles.eyebrow}>Ronda {round.number}</p>
      <h1 id="registrado-titulo" className={styles.title}>
        Voto registrado
      </h1>
      <p className={styles.lead}>
        Se publican los {votes.total} votos a la vez cuando el operador revele
        el veredicto.
      </p>

      <div className={styles.counter} aria-live="polite">
        <span className={styles.count}>{votes.emitted}</span>
        <span className={styles.total}>
          de {votes.total} votos emitidos
        </span>
      </div>
    </section>
  );
}
