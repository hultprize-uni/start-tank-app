import type { JuryCriterion } from "../types";
import styles from "./CriteriaCard.module.css";

interface CriteriaCardProps {
  criteria: readonly JuryCriterion[];
}

/** Recordatorio de los criterios de evaluación, que pesan igual, y del conflicto de interés. */
export function CriteriaCard({ criteria }: CriteriaCardProps) {
  return (
    <section className={styles.card} aria-labelledby="criterios-titulo">
      <p id="criterios-titulo" className={styles.caption}>
        Criterios · mismo peso
      </p>
      <ul className={styles.list}>
        {criteria.map((criterion) => (
          <li key={criterion.id} className={styles.item}>
            {criterion.label}
          </li>
        ))}
      </ul>
      <p className={styles.note}>Si tienes conflicto de interés con esta startup, abstente.</p>
    </section>
  );
}
