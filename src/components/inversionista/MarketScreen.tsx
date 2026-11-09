import type { MarketInfo, RoundInfo, StartupInfo, WalletInfo } from "@/lib/api/investor.types";
import { ActionButton } from "./ActionButton";
import { formatCoins } from "./format";
import { LastCallCountdown } from "./LastCallCountdown";
import { MarketCard } from "./MarketCard";
import { StatusBadge } from "./StatusBadge";
import styles from "./MarketScreen.module.css";

interface MarketScreenProps {
  round: RoundInfo;
  startup: StartupInfo;
  market: MarketInfo;
  wallet: WalletInfo;
  /** Segundos de la última llamada. Nulo mientras el mercado está abierto. */
  countdownSeconds: number | null;
  onInvest: () => void;
}

/** Mercado abierto y última llamada: precio en vivo, tope de la ronda y acceso a Invertir. */
export function MarketScreen({
  round,
  startup,
  market,
  wallet,
  countdownSeconds,
  onInvest,
}: MarketScreenProps) {
  const capRatio = wallet.roundCap > 0 ? wallet.investedInRound / wallet.roundCap : 0;
  const fillPercent = Math.min(100, capRatio * 100);
  const isLastCall = countdownSeconds !== null;

  return (
    <section className={styles.screen}>
      <div className={styles.status}>
        {isLastCall ? (
          <StatusBadge tone="yellow" live>
            Última llamada
          </StatusBadge>
        ) : (
          <StatusBadge tone="cyan" live>
            Mercado abierto
          </StatusBadge>
        )}
        <span className={styles.round}>
          Ronda {round.number} de {round.total}
        </span>
      </div>

      {isLastCall && <LastCallCountdown seconds={countdownSeconds} />}

      <MarketCard startup={startup} market={market} />

      <div className={styles.cap}>
        <div className={styles.capHeader}>
          <span className={styles.label}>Invertido en esta ronda</span>
          <span className={styles.label}>Tope {formatCoins(wallet.roundCap)}</span>
        </div>
        <p className={styles.invested}>
          {formatCoins(wallet.investedInRound)} <span className={styles.unit}>coins</span>
        </p>
        <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fillPercent)}>
          <div className={styles.fill} style={{ width: `${fillPercent}%` }} />
        </div>
      </div>

      <ActionButton variant="primary" size="lg" onClick={onInvest}>
        Invertir
      </ActionButton>
      <p className={styles.note}>
        El precio mide el interés de la sala. Tu retorno depende solo del jurado.
      </p>
    </section>
  );
}
