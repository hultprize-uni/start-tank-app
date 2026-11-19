import type { Closing } from "../types";
import { formatInteger, formatPercentage } from "./format";
import styles from "./screen.module.css";

interface ClosingPhaseProps {
  vm: Closing;
}

/** Fase Cierre del evento: startup ganadora, top 3 de inversionistas y mejor ojo. */
export function ClosingPhase({ vm }: ClosingPhaseProps) {
  const { winner } = vm;
  const points = Math.round(winner.score * 100);

  return (
    <div className={styles.split}>
      <section className={styles.winner} aria-labelledby="winner-title">
        <p className={`${styles.eyebrow} ${styles.accentYellow}`}>Startup ganadora</p>
        <h1 id="winner-title" className={`${styles.title} ${styles.titleWinner}`}>
          {winner.name}
        </h1>
        <p className={styles.badgeText}>
          ODS {winner.sdg.number}: {winner.sdg.name}
        </p>
        <p className={`${styles.figure} ${styles.figureAccent}`}>{points}</p>
        <p className={styles.lead}>de 100 puntos</p>
        <p className={styles.lead}>
          {formatPercentage(winner.backingFraction)} de respaldo del jurado y{" "}
          {formatPercentage(winner.investorPercentage)} de la sala invirtió
        </p>
        <p className={styles.pass}>Pase directo a la gran final</p>
      </section>
      <div className={styles.column}>
        <section aria-labelledby="top-inversionistas">
          <h2 id="top-inversionistas" className={styles.listHeading}>
            Top 3 inversionistas
          </h2>
          <ol className={styles.rows}>
            {vm.top3.map((row) => (
              <li
                key={row.position}
                className={`${styles.row} ${row.position === 1 ? styles.rowFirst : ""}`}
              >
                <span className={styles.rowPosition}>{row.position}</span>
                <span className={styles.rowName}>{row.name}</span>
                <span className={styles.rowValue}>{formatInteger(row.balance)} IC</span>
              </li>
            ))}
          </ol>
        </section>
        <article className={styles.bestEye} aria-label="Mejor ojo">
          <p className={styles.cardLabel}>Mejor ojo</p>
          <p className={styles.bestEyeName}>
            {vm.bestEye.name} con {vm.bestEye.hits} aciertos
          </p>
        </article>
      </div>
    </div>
  );
}
