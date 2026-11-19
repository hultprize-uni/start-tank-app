import { STARTUP_REQUIREMENTS } from "../content";
import styles from "./landing.module.css";

/* Convocatoria a startups: requisitos del pitch y premio del Shark Tank. */
export function StartupCallSection() {
  return (
    <section className={styles.sectionAlt} aria-labelledby="startup-title">
      <div className={styles.container}>
        <div className={styles.twoColumns}>
          <div>
            <h2 id="startup-title" className={styles.sectionTitle}>
              ¿Tienes una startup?
            </h2>
            <p className={styles.sectionLead}>
              Buscamos cinco equipos con fines de lucro y alineados a por lo menos uno de los 17 ODS.
              Cualquier etapa de desarrollo.
            </p>
            <ul className={styles.requirements}>
              {STARTUP_REQUIREMENTS.map((item) => (
                <li key={item.text} className={styles.requirement}>
                  <span className={styles.requirementValue}>{item.value}</span>
                  <span className={styles.requirementText}>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.prize}>
            <p className={styles.prizeLabel}>Premio del Shark Tank</p>
            <h3 className={styles.prizeTitle}>
              Pase directo a la gran final de Hult Prize at UNI
            </h3>
            <p className={styles.prizeText}>
              Para la startup con mayor puntaje al cierre de las cinco rondas: 60% respaldo del jurado
              y 40% tracción en la sala.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
