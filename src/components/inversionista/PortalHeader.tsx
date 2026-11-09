import { BrandMark } from "./BrandMark";
import { formatCoins } from "./format";
import styles from "./PortalHeader.module.css";

interface PortalHeaderProps {
  /** Saldo en coins. Nulo oculta el bloque de saldo, por ejemplo antes del ingreso. */
  balance: number | null;
}

/** Encabezado del portal con la marca y el saldo disponible. */
export function PortalHeader({ balance }: PortalHeaderProps) {
  return (
    <header className={styles.header}>
      <BrandMark size="sm" />
      {balance !== null && (
        <div className={styles.balance}>
          <span className={styles.label}>Saldo</span>
          <span className={styles.value}>{formatCoins(balance)}</span>
        </div>
      )}
    </header>
  );
}
