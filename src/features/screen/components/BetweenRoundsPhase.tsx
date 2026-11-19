import type { BetweenRounds } from "../types";
import { formatInteger } from "./format";
import styles from "./screen.module.css";

/** Filas visibles por leaderboard. La pantalla muestra el total en el pie. */
const VISIBLE_ROWS = 10;

interface BetweenRoundsPhaseProps {
  vm: BetweenRounds;
}

/*
 * Fase Entre rondas: clasificacion de los inversionistas y acumulado de cada
 * startup hasta la ronda cerrada.
 */
export function BetweenRoundsPhase({ vm }: BetweenRoundsPhaseProps) {
  const investors = vm.investors.slice(0, VISIBLE_ROWS);
  const startups = vm.startups.slice(0, VISIBLE_ROWS);

  return (
    <>
      <section>
        <p className={styles.eyebrow}>Ronda {vm.closedRound.number} cerrada</p>
        <h1 className={styles.title}>Clasificación</h1>
      </section>
      <div className={styles.gridTwo}>
        <section className={styles.listTable} aria-labelledby="titulo-inversionistas">
          <h2 id="titulo-inversionistas" className={styles.subtitle}>
            Inversionistas
          </h2>
          <ol className={styles.list}>
            {investors.map((row) => (
              <li key={row.position} className={styles.row}>
                <span>
                  {row.position}. {row.name}
                </span>
                <span className={styles.rowValue}>{formatInteger(row.balance)} IC</span>
              </li>
            ))}
          </ol>
          <p className={styles.footer}>
            Mostrando {investors.length} de {vm.investors.length} inversionistas
          </p>
        </section>
        <section className={styles.listTable} aria-labelledby="titulo-startups">
          <h2 id="titulo-startups" className={styles.subtitle}>
            Startups
          </h2>
          <ol className={styles.list}>
            {startups.map((row) => (
              <li key={row.position} className={styles.row}>
                <span>
                  {row.position}. {row.name}
                </span>
                <span className={styles.rowValue}>
                  {formatInteger(row.accumulated)} IC · precio {formatInteger(row.price)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
