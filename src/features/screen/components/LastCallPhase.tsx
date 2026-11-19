"use client";

import type { LastCall } from "../types";
import { RoundHeader } from "./RoundHeader";
import { MarketMetrics } from "./MarketMetrics";
import styles from "./screen.module.css";

/** Umbral en segundos a partir del cual la cuenta se muestra como cierre inminente. */
const IMMINENT_THRESHOLD = 10;

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${String(minutes).padStart(2, "0")}:${rest}`;
}

interface CountdownProps {
  /** Segundos restantes calculados por el hook con la hora del servidor. */
  seconds: number;
}

/* Presenta la cuenta recibida. El hook `useScreenState` la recalcula cada segundo. */
function Countdown({ seconds }: CountdownProps) {
  const imminent = seconds <= IMMINENT_THRESHOLD;

  return (
    <section aria-label="Cuenta regresiva de la última llamada">
      <p className={styles.eyebrow}>Última llamada: cierre automático</p>
      <p
        className={`${styles.figureLarge} ${styles.figureAccent} ${imminent ? styles.pulse : ""}`}
        role="timer"
      >
        {formatCountdown(seconds)}
      </p>
      {imminent && seconds > 0 ? (
        <p className={styles.subtitle}>El mercado cierra en segundos.</p>
      ) : null}
    </section>
  );
}

interface LastCallPhaseProps {
  vm: LastCall;
}

/** Fase Última llamada: cuenta regresiva de 60 segundos sobre el precio vigente. */
export function LastCallPhase({ vm }: LastCallPhaseProps) {
  return (
    <>
      <RoundHeader round={vm.round} />
      <MarketMetrics
        price={vm.price}
        accumulated={vm.accumulated}
        uniqueInvestors={vm.uniqueInvestors}
      />
      <Countdown seconds={vm.secondsRemaining} />
    </>
  );
}
