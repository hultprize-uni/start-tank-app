import type { MarketView } from "@/lib/api/operator.types";

import { formatCoins } from "./labels";
import styles from "./OperatorConsole.module.css";

interface MarketPanelProps {
  market: MarketView;
}

/** Resumen del mercado de la ronda: monto acumulado, inversores únicos y precio en vivo. */
export function MarketPanel({ market }: MarketPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="mercado-ronda">
      <div className={styles.panelHeader}>
        <h3 id="mercado-ronda" className={styles.panelTitle}>
          Mercado
        </h3>
      </div>
      <div className={styles.marketGrid}>
        <div className={styles.marketStat}>
          <span className={styles.muted}>Acumulado</span>
          <p className={`${styles.marketValue} st-num`}>
            {formatCoins(market.accumulated)}{" "}
            <span className={styles.muted}>coins</span>
          </p>
        </div>
        <div className={styles.marketStat}>
          <span className={styles.muted}>Inversores únicos</span>
          <p className={`${styles.marketValue} st-num`}>
            {formatCoins(market.uniqueInvestors)}{" "}
            <span className={styles.muted}>
              de {formatCoins(market.connectedAttendees)}
            </span>
          </p>
        </div>
        <div className={styles.marketStat}>
          <span className={styles.muted}>Precio en vivo</span>
          <p className={`${styles.marketValue} ${styles.marketValueAccent} st-num`}>
            {formatCoins(market.price)}
          </p>
        </div>
      </div>
    </section>
  );
}
