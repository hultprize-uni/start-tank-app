import { StatBlock } from "@/shared/ui";
import { EVENT_FACTS } from "../content";
import { toneClass } from "./tone";
import styles from "./landing.module.css";

/* Cifras del evento: asistentes, startups, jurados y capital por asistente. */
export function EventFacts() {
  return (
    <section id="evento" className={styles.facts} aria-label="Datos del evento">
      <div className={styles.factsGrid}>
        {EVENT_FACTS.map((fact) => (
          <div key={fact.label} className={styles.factItem}>
            <StatBlock
              size="lg"
              label={fact.label}
              value={<span className={toneClass(fact.tone)}>{fact.value}</span>}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
