import { StatBlock } from "@/shared/ui";

import { formatCoins } from "../labels";
import type { MarketView } from "../types";

import styles from "./Admin.module.css";

interface MarketPanelProps {
  market: MarketView;
}

/** Porcentaje de la sala conectada que ya invirtió en la ronda. */
export function investedShare(market: MarketView): number {
  if (market.totalAttendees === 0) return 0;
  return Math.round((market.uniqueInvestors / market.totalAttendees) * 100);
}

/** Lectura en vivo del mercado de la ronda (RF-26): monto, precio, inversores y sala que invirtió. */
export function MarketPanel({ market }: MarketPanelProps) {
  return (
    <section aria-label="Mercado de la ronda" className={styles.stats}>
      <div className={styles.stat}>
        <StatBlock label="Monto acumulado" value={`${formatCoins(market.accumulated)} IC`} size="lg" />
      </div>
      <div className={styles.stat}>
        <StatBlock label="Precio" value={market.price.toFixed(1)} size="lg" />
      </div>
      <div className={styles.stat}>
        <StatBlock label="Inversores únicos" value={formatCoins(market.uniqueInvestors)} size="lg" />
      </div>
      <div className={styles.stat}>
        <StatBlock label="Sala que invirtió" value={`${investedShare(market)}%`} size="lg" />
      </div>
    </section>
  );
}
