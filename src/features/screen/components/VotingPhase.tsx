import type { Voting } from "../types";
import { RoundHeader } from "./RoundHeader";
import styles from "./screen.module.css";

interface VotingPhaseProps {
  vm: Voting;
}

/*
 * Fase Votacion: el jurado delibera. Solo se cuentan los votos emitidos;
 * su sentido no se muestra hasta la liquidacion.
 */
export function VotingPhase({ vm }: VotingPhaseProps) {
  const indices = Array.from({ length: vm.jurorsTotal }, (_, index) => index);

  return (
    <>
      <RoundHeader round={vm.round} />
      <section>
        <p className={styles.eyebrow}>Votación en curso</p>
        <p className={styles.subtitle}>El jurado delibera. Los votos se revelan al cierre.</p>
      </section>
      <section>
        <p className={`${styles.figureLarge} ${styles.figureAccent}`}>
          {vm.votesCast} de {vm.jurorsTotal}
        </p>
        <p className={styles.subtitle}>votos emitidos</p>
      </section>
      <div className={styles.dotRow} role="img" aria-label={`${vm.votesCast} de ${vm.jurorsTotal} votos emitidos`}>
        {indices.map((index) => (
          <span
            key={index}
            className={`${styles.dot} ${index < vm.votesCast ? styles.dotCast : ""}`}
          />
        ))}
      </div>
    </>
  );
}
