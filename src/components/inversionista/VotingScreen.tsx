import type { RoundInfo, StartupInfo, WalletInfo } from "@/lib/api/investor.types";
import { ActionButton } from "./ActionButton";
import { formatCoins } from "./format";
import { StatusBadge } from "./StatusBadge";
import styles from "./VotingScreen.module.css";

interface VotingScreenProps {
  round: RoundInfo;
  startup: StartupInfo;
  wallet: WalletInfo;
}

/** Votación: el mercado cerró y el jurado delibera. La inversión queda bloqueada. */
export function VotingScreen({ round, startup, wallet }: VotingScreenProps) {
  return (
    <section className={styles.screen}>
      <StatusBadge tone="pink">Mercado cerrado</StatusBadge>
      <h1 className={styles.title}>El jurado delibera.</h1>
      <p className={styles.lead}>
        {startup.name} · Ronda {round.number} de {round.total}. El operador revelará el veredicto
        cuando los cuatro jurados voten.
      </p>

      <div className={styles.invested}>
        <span className={styles.label}>Tu inversión</span>
        <span className={styles.amount}>{formatCoins(wallet.investedInRound)}</span>
      </div>

      <ActionButton variant="muted" size="lg" disabled>
        Invertir · bloqueado
      </ActionButton>
    </section>
  );
}
