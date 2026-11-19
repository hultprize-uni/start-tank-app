import { PITCH_SCHEDULE, SHARK_TANK_SCHEDULE, type ScheduleItem } from "../content";
import { toneClass } from "./tone";
import styles from "./landing.module.css";

interface ScheduleListProps {
  items: ScheduleItem[];
  label: string;
}

/** Lista de horarios de una parte del programa. La hora va en un elemento time. */
function ScheduleList({ items, label }: ScheduleListProps) {
  return (
    <ul className={styles.schedule} aria-label={label}>
      {items.map((item) => (
        <li key={item.time} className={styles.scheduleItem}>
          <time dateTime={item.time} className={`${styles.scheduleTime} ${toneClass(item.tone)}`}>
            {item.time}
          </time>
          <span className={styles.scheduleText}>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

/* Programa de la jornada en dos partes: Shark Tank y la sesión de idea millonaria. */
export function ProgramSection() {
  return (
    <section id="programa" className={styles.section} aria-labelledby="program-title">
      <div className={styles.container}>
        <h2 id="program-title" className={styles.sectionTitle}>
          Tres horas, dos partes
        </h2>
        <p className={styles.sectionLead}>
          El Shark Tank ocupa la primera mitad. La segunda arma equipos nuevos y les pide una idea
          millonaria en veinte minutos.
        </p>
        <div className={styles.twoColumns}>
          <div>
            <h3 className={styles.partTitle}>
              <span className={`${styles.partMark} ${styles.markPink}`} aria-hidden="true" />
              Shark Tank
              <span className={styles.partTime}>14:00 a 15:50</span>
            </h3>
            <ScheduleList items={SHARK_TANK_SCHEDULE} label="Horario del Shark Tank" />
          </div>
          <div>
            <h3 className={styles.partTitle}>
              <span className={`${styles.partMark} ${styles.markCyan}`} aria-hidden="true" />
              Idea millonaria en 20 minutos
              <span className={styles.partTime}>15:50 a 17:00</span>
            </h3>
            <ScheduleList items={PITCH_SCHEDULE} label="Horario de la idea millonaria" />
            <p className={styles.callout}>
              El grupo ganador entra a Hult Prize at UNI con esa misma idea.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
