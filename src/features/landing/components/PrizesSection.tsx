import { PRIZES } from "../content";
import styles from "./landing.module.css";

/* Premios: el Shark Tank y la dinámica express. */
export function PrizesSection() {
  return (
    <section className={styles.section} aria-label="Premios">
      <ul className={`${styles.container} ${styles.prizes}`}>
        {PRIZES.map((prize) => (
          <li
            key={prize.tag}
            className={`${styles.prize} ${prize.tone === "pink" ? styles.prizePink : styles.prizeCyan}`}
          >
            <p className={styles.prizeTag}>{prize.tag}</p>
            <h2 className={styles.prizeTitle}>{prize.title}</h2>
            <p className={styles.prizeText}>{prize.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
