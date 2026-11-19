import type { Waiting } from "../types";
import styles from "./screen.module.css";

interface WaitingPhaseProps {
  vm: Waiting;
}

/*
 * Fase de espera previa: ninguna ronda ha iniciado. Presenta la primera startup del programa
 * mientras el operador prepara el evento.
 */
export function WaitingPhase({ vm }: WaitingPhaseProps) {
  const { startup } = vm.nextRound;

  return (
    <section className={`${styles.column} ${styles.centered}`} aria-labelledby="waiting-title">
      <p className={styles.eyebrow}>A continuación</p>
      <h1 id="waiting-title" className={styles.title}>
        {startup.name}
      </h1>
      <p className={styles.badgeText}>
        ODS {startup.sdg.number}: {startup.sdg.name}
      </p>
      <p className={styles.lead}>El mercado abrirá en breve.</p>
    </section>
  );
}
