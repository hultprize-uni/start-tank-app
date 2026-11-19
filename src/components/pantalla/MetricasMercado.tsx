import styles from "./pantalla.module.css";
import { formatInteger } from "./formato";

interface MarketMetricsProps {
  price: number;
  accumulated: number;
  uniqueInvestors: number;
}

/** Precio en vivo y las dos cifras de participación de la ronda: monto acumulado e inversores únicos. */
export function MarketMetrics({ price: price, accumulated: accumulated, uniqueInvestors: uniqueInvestors }: MarketMetricsProps) {
  return (
    <div>
      <p className={styles.eyebrow}>Precio en vivo</p>
      <p className={styles.figureLarge} aria-label={`Precio ${price}`}>
        {formatInteger(price)}
      </p>
      <div className={styles.grid}>
        <article className={styles.card}>
          <p className={styles.eyebrow}>Monto acumulado</p>
          <p className={`${styles.cardValue} ${styles.accentCyan}`}>
            {formatInteger(accumulated)} IC
          </p>
        </article>
        <article className={styles.card}>
          <p className={styles.eyebrow}>Inversores únicos</p>
          <p className={`${styles.cardValue} ${styles.accentYellow}`}>
            {formatInteger(uniqueInvestors)}
          </p>
        </article>
      </div>
    </div>
  );
}
