import { BrandLogo } from "@/shared/ui";
import { SignOutButton } from "./SignOutButton";
import { WalletBalance } from "./WalletBalance";
import styles from "./PortalHeader.module.css";

interface PortalHeaderProps {
  /** Saldo disponible en coins. */
  balance: number;
}

/** Cabecera del móvil: marca, saldo y cierre de sesión. */
export function PortalHeader({ balance }: PortalHeaderProps) {
  return (
    <header className={styles.header}>
      <BrandLogo variant="horizontal" className={styles.logo} />
      <div className={styles.actions}>
        <WalletBalance balance={balance} />
        <SignOutButton />
      </div>
    </header>
  );
}
