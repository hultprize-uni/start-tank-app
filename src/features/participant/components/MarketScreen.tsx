"use client";

import { Badge, Button, MarketCard } from "@/shared/ui";
import type { PhaseClock } from "@/shared/domain/types";
import { usePhaseSeconds } from "@/shared/lib/use-server-clock";
import { formatCoins, formatPriceChange } from "../format";
import type { MarketInfo, RoundInfo, StartupInfo, WalletInfo } from "../types";
import { LastCallCountdown } from "./LastCallCountdown";
import styles from "./MarketScreen.module.css";

interface MarketScreenProps {
  round: RoundInfo;
  startup: StartupInfo;
  market: MarketInfo;
  wallet: WalletInfo;
  /** Verdadero en la última llamada. */
  lastCall: boolean;
  clock: PhaseClock | null;
  onInvest: () => void;
}

/** Minutos y segundos, por ejemplo "12:05". */
function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Mercado abierto y última llamada (RF-23): precio en vivo, saldo, cronómetro con la hora del
 * servidor y acceso a la inversión. Con la ronda en pausa o ya invertida, el botón no aparece.
 */
export function MarketScreen({ round, startup, market, wallet, lastCall, clock, onInvest }: MarketScreenProps) {
  const seconds = usePhaseSeconds(clock);
  const paused = clock?.paused ?? false;
  const roundLabel = `Ronda ${round.number} de ${round.total}`;

  return (
    <section className={styles.screen}>
      <h1 className="visually-hidden">Mercado de la {roundLabel.toLowerCase()}</h1>

      <div className={styles.status}>
        {paused ? (
          <Badge tone="yellow">Mercado en pausa</Badge>
        ) : lastCall ? (
          <Badge tone="yellow" live>
            Última llamada
          </Badge>
        ) : (
          <Badge tone="cyan" live>
            Mercado abierto
          </Badge>
        )}
        {!lastCall && seconds !== null ? (
          <span className={styles.timer} aria-label={`Quedan ${formatClock(seconds)} de mercado`}>
            Cierra en {formatClock(seconds)}
          </span>
        ) : null}
      </div>

      {lastCall && seconds !== null ? <LastCallCountdown seconds={seconds} /> : null}

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

      {wallet.alreadyInvested ? (
        <div className={styles.cap} role="status">
          <span className={styles.label}>Ya invertiste en esta ronda</span>
          <p className={styles.invested}>
            {formatCoins(wallet.investedInRound)} <span className={styles.unit}>coins</span>
          </p>
          <p className={styles.note}>Tu resultado depende del puntaje del jurado. Llega al revelar.</p>
        </div>
      ) : paused ? (
        <p className={styles.cap} role="status">
          El conductor pausó el mercado. Podrás invertir cuando lo reanude.
        </p>
      ) : (
        <>
          <div className={styles.cap}>
            <div className={styles.capHeader}>
              <span className={styles.label}>Tu saldo</span>
              <span className={styles.label}>Tope {formatCoins(wallet.roundCap)}</span>
            </div>
            <p className={styles.invested}>
              {formatCoins(wallet.balance)} <span className={styles.unit}>coins</span>
            </p>
          </div>
          <Button variant="primary" size="lg" fullWidth onClick={onInvest}>
            Invertir
          </Button>
        </>
      )}

      <p className={styles.note}>
        El precio mide el interés de la sala. Tu retorno depende solo del jurado.
      </p>
    </section>
  );
}
