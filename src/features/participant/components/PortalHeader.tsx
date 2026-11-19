import { BrandMark } from "./BrandMark";
import { formatCoins } from "./format";
import { SignOutButton } from "./SignOutButton";
import styles from "./PortalHeader.module.css";

interface PortalHeaderProps {
  /** Saldo en coins. Nulo oculta el bloque de saldo, por ejemplo antes del ingreso. */
  balance: number | null;
}

/** Encabezado del portal con la marca, el saldo disponible y el cierre de sesión. */
export function PortalHeader({ balance }: PortalHeaderProps) {
  return (
    <header className={styles.header}>
      <BrandMark size="sm" />
      <div className={styles.actions}>
        {balance !== null && (
          <div className={styles.balance}>
            <span className={styles.label}>Saldo</span>
            <span className={styles.value}>{formatCoins(balance)}</span>
          </div>
        )}
        <SignOutButton />
      </div>
    </header>
  );
}
