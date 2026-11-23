import { HOW_TO_PLAY, MULTIPLIER_BARS } from "../content";
import styles from "./landing.module.css";

/** Clase de color de cada barra del multiplicador, de puntaje 1 a 5. */
const BAR_TONE = [styles.barLoss, styles.barLoss, styles.barNeutral, styles.barGain, styles.barTop];

/* Cómo se juega: los cuatro pasos en orden y el gráfico del multiplicador según el puntaje. */
export function RulesSection() {
  return (
    <section id="como-se-juega" className={styles.section} aria-labelledby="rules-title">
      <div className={styles.container}>
        <p className={styles.pillPink}>Cómo se juega</p>
        <h2 id="rules-title" className={styles.sectionTitle}>
          Inviertes una vez por ronda. El jurado mueve tu dinero.
        </h2>

        <ol className={styles.steps}>
          {HOW_TO_PLAY.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>

        <figure className={styles.multiplier}>
          <figcaption className={styles.multiplierCopy}>
            <h3 className={styles.multiplierTitle}>Así se calcula tu retorno</h3>
            <p className={styles.multiplierText}>
              Multiplicador = 0.2 + 1.6 × (puntaje − 1) / 4. Un 3 es punto neutro: ni ganas ni pierdes.
            </p>
          </figcaption>
          <ul className={styles.bars} aria-label="Multiplicador según el puntaje del jurado">
            {MULTIPLIER_BARS.map((bar, index) => (
              <li key={bar.score} className={styles.barItem}>
                <span className={styles.barValue}>{bar.multiplier}</span>
                <span
                  className={`${styles.bar} ${BAR_TONE[index]}`}
                  style={{ "--bar-height": `${20 + index * 20}%` } as React.CSSProperties}
                  aria-hidden="true"
                />
                <span className={styles.barLabel}>Puntaje {bar.score}</span>
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </section>
  );
}
