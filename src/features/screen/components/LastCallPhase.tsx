import { Countdown } from "@/shared/ui";
import type { LastCall } from "../types";
import { MarketView } from "./MarketPhase";
import styles from "./screen.module.css";

/** Umbral en segundos a partir del cual la cuenta se presenta como cierre inminente. */
const IMMINENT_THRESHOLD = 10;

interface LastCallPhaseProps {
  vm: LastCall;
}

/*
 * Fase Última llamada: el mercado sigue abierto y la cuenta regresiva se muestra sobre el precio.
 * El hook `useScreenState` recalcula los segundos restantes cada segundo.
 */
export function LastCallPhase({ vm }: LastCallPhaseProps) {
  const imminent = vm.secondsRemaining <= IMMINENT_THRESHOLD;

  return (
    <MarketView
      round={vm.round}
      price={vm.price}
      accumulated={vm.accumulated}
      uniqueInvestors={vm.uniqueInvestors}
    >
      <div className={`${styles.lastCallChip} ${imminent ? styles.pulse : ""}`}>
        <span className={styles.lastCallLabel}>Última llamada</span>
        <Countdown
          seconds={vm.secondsRemaining}
          label="Tiempo restante de la última llamada"
          tone="warning"
        />
      </div>
      {imminent && vm.secondsRemaining > 0 ? (
        <p className={styles.footnote}>El mercado cierra en segundos.</p>
      ) : null}
    </MarketView>
  );
}
