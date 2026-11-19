import type { Closing } from "../types";
import { formatInteger, formatPercentage } from "./format";
import styles from "./screen.module.css";

interface ClosingPhaseProps {
  vm: Closing;
}

/** Fase Cierre del evento: startup ganadora, top 3 de inversionistas y mejor ojo. */
export function ClosingPhase({ vm }: ClosingPhaseProps) {
  const { winner: winner } = vm;
  const points = Math.round(winner.score * 100);

  return (
    <>
      <section className={styles.winner} aria-label="Startup ganadora">
        <p className={styles.eyebrow}>Startup ganadora</p>
        <h1 className={`${styles.title} ${styles.winnerTitle}`}>{winner.name}</h1>
        <p className={styles.badge}>
          ODS {winner.sdg.number}: {winner.sdg.name}
        </p>
        <p className={`${styles.figureLarge} ${styles.accentYellow}`}>
          {points} <span className={styles.subtitle}>de 100 puntos</span>
        </p>
        <p className={styles.subtitle}>
          {formatPercentage(winner.backingFraction)} de respaldo del jurado y{" "}
          {formatPercentage(winner.investorPercentage)} de la sala invirtió
        </p>
      </section>
      <div className={styles.grid}>
        {vm.top3.map((row) => (
          <article key={row.position} className={styles.card}>
            <p className={styles.eyebrow}>Puesto {row.position}</p>
            <p className={styles.subtitle}>{row.name}</p>
            <p className={`${styles.cardValue} ${styles.accentCyan}`}>
              {formatInteger(row.balance)} IC
            </p>
          </article>
        ))}
      </div>
      <article className={styles.card} aria-label="Mejor ojo">
        <p className={styles.eyebrow}>Mejor ojo</p>
        <p className={styles.subtitle}>
          {vm.bestEye.name} con {vm.bestEye.hits} aciertos
        </p>
      </article>
    </>
  );
}
