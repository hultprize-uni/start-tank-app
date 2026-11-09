import type { MarketInfo, StartupInfo } from "@/lib/api/investor.types";
import { formatCoins, formatPriceChange } from "./format";
import styles from "./MarketCard.module.css";

interface MarketCardProps {
  startup: StartupInfo;
  market: MarketInfo;
}

/** Tarjeta del mercado: precio en vivo, monto de la sala y número de inversionistas. */
export function MarketCard({ startup, market }: MarketCardProps) {
  const changeTone =
    market.priceChange > 0 ? styles.up : market.priceChange < 0 ? styles.down : styles.flat;

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <p className={styles.ods}>{startup.ods}</p>
        <h2 className={styles.name}>{startup.name}</h2>
      </header>

      <div className={styles.price}>
        <span className={styles.label}>Precio</span>
        <div className={styles.priceRow}>
          <span className={styles.priceValue}>{market.price}</span>
          <span className={`${styles.change} ${changeTone}`}>
            {formatPriceChange(market.priceChange)}
          </span>
        </div>
      </div>

      <dl className={styles.stats}>
        <div>
          <dt className={styles.label}>Monto de la sala</dt>
          <dd className={styles.statValue}>{formatCoins(market.totalRaised)}</dd>
        </div>
        <div>
          <dt className={styles.label}>Inversionistas</dt>
          <dd className={styles.statValue}>{market.investorCount}</dd>
        </div>
      </dl>
    </article>
  );
}
