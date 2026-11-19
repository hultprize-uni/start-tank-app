import { Badge, Button, MarketCard, ProgressBar } from "@/shared/ui";
import { formatCoins, formatPriceChange } from "../format";
import type { MarketInfo, RoundInfo, StartupInfo, WalletInfo } from "../types";
import { LastCallCountdown } from "./LastCallCountdown";
import styles from "./MarketScreen.module.css";

interface MarketScreenProps {
  round: RoundInfo;
  startup: StartupInfo;
  market: MarketInfo;
  wallet: WalletInfo;
  /** Segundos de la última llamada. Nulo mientras el mercado está abierto. */
  countdownSeconds: number | null;
  /** Abre la hoja de inversión. Solo se pasa en el móvil; en el escritorio el formulario va en línea. */
  onInvest?: () => void;
}

/** Mercado abierto y última llamada: precio en vivo, tope de la ronda y acceso a la inversión. */
export function MarketScreen({
  round,
  startup,
  market,
  wallet,
  countdownSeconds,
  onInvest,
}: MarketScreenProps) {
  const isLastCall = countdownSeconds !== null;
  const roundLabel = `Ronda ${round.number} de ${round.total}`;

  return (
    <section className={styles.screen}>
      <h1 className="visually-hidden">Mercado de la {roundLabel.toLowerCase()}</h1>

      <div className={styles.status}>
        {isLastCall ? (
          <Badge tone="yellow" live>
            Última llamada
          </Badge>
        ) : (
          <Badge tone="cyan" live>
            Mercado abierto
          </Badge>
        )}
      </div>

      {isLastCall ? <LastCallCountdown seconds={countdownSeconds} /> : null}

      <MarketCard
        name={startup.name}
        ods={startup.sdg}
        price={market.price}
        delta={formatPriceChange(market.priceChange)}
        deltaTone={market.priceChange < 0 ? "negative" : "positive"}
        total={formatCoins(market.totalRaised)}
        totalLabel="Monto de la sala"
        investors={market.investorCount}
        investorsLabel="Inversionistas"
        roundLabel={roundLabel}
        headingLevel={2}
      />

      <div className={styles.cap}>
        <div className={styles.capHeader}>
          <span className={styles.label}>Invertido en esta ronda</span>
          <span className={styles.label}>Tope {formatCoins(wallet.roundCap)}</span>
        </div>
        <p className={styles.invested}>
          {formatCoins(wallet.investedInRound)} <span className={styles.unit}>coins</span>
        </p>
        <ProgressBar
          value={wallet.investedInRound}
          max={Math.max(1, wallet.roundCap)}
          label="Uso del tope de la ronda"
          valueText={`${formatCoins(wallet.investedInRound)} de ${formatCoins(wallet.roundCap)} coins`}
        />
      </div>

      {onInvest ? (
        <Button variant="primary" size="lg" fullWidth onClick={onInvest}>
          Invertir
        </Button>
      ) : null}

      <p className={styles.note}>
        El precio mide el interés de la sala. Tu retorno depende solo del jurado.
      </p>
    </section>
  );
}
