import type { JuryCriterion } from "@/lib/api/jury.types";
import styles from "./CriteriaReminder.module.css";

interface CriteriaReminderProps {
  criteria: readonly JuryCriterion[];
}

/** Recordatorio de los criterios de evaluación, que pesan igual. */
export function CriteriaReminder({ criteria }: CriteriaReminderProps) {
  return (
    <div className={styles.reminder}>
      <span className={styles.caption}>Criterios (peso igual)</span>
      <ul className={styles.list}>
        {criteria.map((criterion) => (
          <li key={criterion.id} className={styles.item}>
            {criterion.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
