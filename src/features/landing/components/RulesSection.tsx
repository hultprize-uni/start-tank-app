import { PAYOFF_LEVELS, ROUND_PHASES, RULE_CARDS } from "../content";
import { toneClass } from "./tone";
import styles from "./landing.module.css";

/** Clase de cada segmento de la barra de la ronda, en el orden de las fases. El ancho proporcional va en la clase. */
const SEGMENT_CLASS = [styles.segCyan, styles.segCyanLight, styles.segYellow, styles.segPink, styles.segPurple];

/** Altura de cada barra del gráfico de retorno, de menor a mayor. */
const PAYOFF_BAR_CLASS = [styles.payoffBar1, styles.payoffBar2, styles.payoffBar3, styles.payoffBar4, styles.payoffBar5];

/* Reglas del juego: duración de la ronda, fases, escenarios de retorno y reglas de inversión. */
export function RulesSection() {
  return (
    <section id="reglas" className={styles.sectionAlt} aria-labelledby="rules-title">
      <div className={styles.container}>
        <h2 id="rules-title" className={styles.sectionTitle}>
          Una ronda dura trece minutos
        </h2>
        <p className={styles.sectionLead}>
          La secuencia se repite cinco veces. El mercado abre con el pitch y cierra en la última
          llamada.
        </p>

        <div className={styles.roundBar} aria-hidden="true">
          {ROUND_PHASES.map((phase, index) => (
            <span key={phase.title} className={SEGMENT_CLASS[index]} />
          ))}
        </div>
        <ol className={styles.phaseList}>
          {ROUND_PHASES.map((phase) => (
            <li key={phase.title} className={styles.phaseItem}>
              <p className={`${styles.phaseDuration} ${toneClass(phase.tone)}`}>
                {phase.duration}
              </p>
              <p className={styles.phaseTitle}>{phase.title}</p>
              <p className={styles.phaseText}>{phase.text}</p>
            </li>
          ))}
        </ol>

        <h3 className={styles.subTitle}>Ganas solo si el jurado te da la razón</h3>
        <p className={styles.sectionLead}>
          El retorno depende del respaldo del jurado, no del precio. Con el jurado dividido recuperas
          lo invertido y nada más.
        </p>

        <ul className={styles.payoff} aria-label="Retorno según los respaldos del jurado">
          {PAYOFF_LEVELS.map((level, index) => (
            <li key={level.votes} className={styles.payoffItem}>
              <p className={`${styles.payoffMultiplier} ${toneClass(level.tone)}`}>
                {level.multiplier}
              </p>
              <div className={`${styles.payoffBar} ${PAYOFF_BAR_CLASS[index]}`} aria-hidden="true" />
              <p className={styles.payoffVotes}>{level.votes}</p>
              <p className={styles.payoffNote}>{level.note}</p>
            </li>
          ))}
        </ul>

        <ul className={styles.ruleCards}>
          {RULE_CARDS.map((card) => (
            <li key={card.title} className={styles.ruleCard}>
              <p className={styles.ruleTitle}>{card.title}</p>
              <p className={styles.ruleText}>{card.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
