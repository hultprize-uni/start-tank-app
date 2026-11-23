import { EVENT_FACTS } from "../content";
import styles from "./landing.module.css";

/* Datos del evento: fecha, hora, lugar y aforo. */
export function EventFacts() {
  return (
    <section id="evento" className={styles.facts} aria-label="Datos del evento">
      <dl className={styles.factsGrid}>
        {EVENT_FACTS.map((fact) => (
          <div key={fact.value} className={styles.fact}>
            <dt className={styles.factValue}>{fact.value}</dt>
            <dd className={styles.factLabel}>{fact.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
