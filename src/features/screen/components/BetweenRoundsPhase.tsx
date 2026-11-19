import type { BetweenRounds } from "../types";
import { formatInteger, formatPrice } from "./format";
import styles from "./screen.module.css";

/** Filas visibles de cada lista. El pie indica el total cuando la lista se recorta. */
const INVESTOR_ROWS = 7;
const STARTUP_ROWS = 6;

interface BetweenRoundsPhaseProps {
  vm: BetweenRounds;
}

/*
 * Fase Entre rondas: clasificación de los inversionistas y acumulado de cada startup hasta la ronda
 * cerrada. La barra de cada startup se mide frente a la startup con mayor acumulado.
 */
export function BetweenRoundsPhase({ vm }: BetweenRoundsPhaseProps) {
  const investors = vm.investors.slice(0, INVESTOR_ROWS);
  const startups = vm.startups.slice(0, STARTUP_ROWS);
  const maxAccumulated = Math.max(1, ...startups.map((row) => row.accumulated));

  return (
    <section className={styles.column} aria-label="Clasificación entre rondas">
      <p className={styles.eyebrow}>Ronda {vm.closedRound.number} cerrada</p>
      <h1 className={styles.title}>Clasificación</h1>
      <div className={styles.grid2}>
        <section aria-labelledby="titulo-inversionistas">
          <h2 id="titulo-inversionistas" className={styles.listHeading}>
            Inversionistas
          </h2>
          <ol className={styles.rows}>
            {investors.map((row) => (
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
          <p className={styles.footnote}>
            Mostrando {investors.length} de {vm.investors.length} inversionistas
          </p>
        </section>
        <section aria-labelledby="titulo-startups">
          <h2 id="titulo-startups" className={styles.listHeading}>
            Startups
          </h2>
          <ol className={styles.rows}>
            {startups.map((row) => (
              <li key={row.position} className={styles.row}>
                <div className={styles.rowName}>
                  <span>{row.name}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${(row.accumulated / maxAccumulated) * 100}%` }}
                    />
                  </div>
                </div>
                <span className={styles.rowValue}>
                  {formatInteger(row.accumulated)} IC · {formatPrice(row.price)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
