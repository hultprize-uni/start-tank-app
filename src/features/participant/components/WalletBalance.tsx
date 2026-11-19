import { formatCoins } from "../format";
import styles from "./WalletBalance.module.css";

interface WalletBalanceProps {
  /** Saldo disponible en Impact Coins. */
  balance: number;
  /** Tamaño de la cifra. "lg" muestra la unidad y el marco de marca del escritorio. */
  size?: "sm" | "lg";
}

/** Saldo del asistente. La versión grande acompaña al riel lateral del escritorio. */
export function WalletBalance({ balance, size = "sm" }: WalletBalanceProps) {
  return (
    <div className={`${styles.wallet} ${styles[size]}`}>
      <span className={styles.label}>Saldo</span>
      <span className={styles.value}>{formatCoins(balance)}</span>
      {size === "lg" ? <span className={styles.unit}>Impact Coins</span> : null}
    </div>
  );
}
