import type { JuryPhase } from "../types";
import { PHASE_COPY } from "./copy";
import styles from "./WaitingScreen.module.css";

interface WaitingScreenProps {
  phase: JuryPhase;
}

/** Espera de la votación: la ronda aún no está abierta para votar o el evento ha terminado. */
export function WaitingScreen({ phase }: WaitingScreenProps) {
  const copy = PHASE_COPY[phase];

  return (
    <section className={styles.panel} aria-labelledby="espera-titulo" aria-live="polite">
      <h2 id="espera-titulo" className={styles.title}>
        {copy.waitTitle}
      </h2>
      <p className={styles.text}>{copy.waitText}</p>
    </section>
  );
}
