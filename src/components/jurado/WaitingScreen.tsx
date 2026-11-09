import type { JuryCriterion, JuryRoundView } from "@/lib/api/jury.types";
import { CriteriaReminder } from "./CriteriaReminder";
import styles from "./WaitingScreen.module.css";

interface WaitingScreenProps {
  round: JuryRoundView;
  criteria: readonly JuryCriterion[];
}

/** Espera de la votación: la ronda aún no está abierta para votar. */
export function WaitingScreen({ round, criteria }: WaitingScreenProps) {
  return (
    <section className={styles.panel} aria-labelledby="espera-titulo">
      <div className={styles.top}>
        <p className={styles.eyebrow}>Ronda {round.number}</p>
        <CriteriaReminder criteria={criteria} />
      </div>

      <div className={styles.status}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.statusText}>En espera</span>
      </div>

      <h1 id="espera-titulo" className={styles.title}>
        Esperando la votación
      </h1>
      <p className={styles.lead}>
        La votación se abrirá cuando el operador la habilite. Mantén tu
        atención en la presentación de {round.startupName}.
      </p>
    </section>
  );
}
