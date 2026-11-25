import { SCHEDULE } from "../content";
import styles from "./landing.module.css";

/* Programa del jueves, en dos columnas en escritorio y una en teléfono. */
export function ProgramSection() {
  return (
    <section id="programa" className={styles.section} aria-labelledby="program-title">
      <div className={styles.container}>
        <h2 id="program-title" className={styles.sectionTitle} data-reveal="sweep">
          Programa del jueves
        </h2>
        <ol className={styles.schedule}>
          {SCHEDULE.map((item, index) => (
            <li key={item.time} className={styles.scheduleItem} data-reveal style={{ "--reveal-delay": `${index * 70}ms` } as React.CSSProperties}>
              <time className={styles.scheduleTime}>{item.time}</time>
              <div>
                <p className={styles.scheduleTitle}>{item.title}</p>
                {item.text ? <p className={styles.scheduleText}>{item.text}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
