import { BrandLogo } from "@/shared/ui";
import type { RoundSummary } from "../types";
import { RoundRail } from "./RoundRail";
import { SignOutButton } from "./SignOutButton";
import { WalletBalance } from "./WalletBalance";
import styles from "./PortalSidebar.module.css";

interface PortalSidebarProps {
  balance: number;
  rounds: RoundSummary[];
}

/** Barra lateral del escritorio: marca del evento, saldo, riel de rondas y cierre de sesión. */
export function PortalSidebar({ balance, rounds }: PortalSidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Resumen del evento">
      <BrandLogo variant="horizontal" className={styles.logo} />
      <p className={styles.event}>
        Shark Tank Universitario
        <br />
        26 Nov · Auditorio CTIC
      </p>
      <WalletBalance balance={balance} size="lg" />
      <RoundRail rounds={rounds} />
      <div className={styles.footer}>
        <SignOutButton />
      </div>
    </aside>
  );
}
