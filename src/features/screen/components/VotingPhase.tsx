import type { Voting } from "../types";
import styles from "./screen.module.css";

interface VotingPhaseProps {
  vm: Voting;
}

/*
 * Fase Votación: el jurado delibera. Solo se cuentan los votos emitidos;
 * su sentido no se muestra hasta la liquidación.
 */
export function VotingPhase({ vm }: VotingPhaseProps) {
  const indices = Array.from({ length: vm.jurorsTotal }, (_, index) => index);

  return (
    <section className={`${styles.column} ${styles.centered}`} aria-labelledby="voting-title">
      <p className={styles.badgeText}>{vm.round.startup.name}</p>
      <h1 id="voting-title" className={styles.title}>
        El jurado delibera
      </h1>
      <p className={styles.lead}>
        Los votos se publican a la vez cuando el operador revela el veredicto.
      </p>
      <div
        className={styles.squares}
        role="img"
        aria-label={`${vm.votesCast} de ${vm.jurorsTotal} votos emitidos`}
      >
        {indices.map((index) => (
          <span
            key={index}
            className={
              index < vm.votesCast ? `${styles.square} ${styles.squareCast}` : styles.square
            }
          />
        ))}
      </div>
      <p className={styles.dotNote}>
        {vm.votesCast} / {vm.jurorsTotal} votos emitidos
      </p>
    </section>
  );
}
