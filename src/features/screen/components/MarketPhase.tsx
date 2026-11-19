import type { ReactNode } from "react";
import { GradientCard, StatBlock } from "@/shared/ui";
import type { RoundRef, OpenMarket } from "../types";
import { formatInteger, formatPrice } from "./format";
import styles from "./screen.module.css";

interface MarketViewProps {
  round: RoundRef;
  price: number;
  accumulated: number;
  uniqueInvestors: number;
  /** Contenido adicional bajo el nombre de la startup, por ejemplo la cuenta de la última llamada. */
  children?: ReactNode;
}

/*
 * Diseño compartido por las fases de mercado y última llamada: nombre de la startup a la izquierda,
 * precio en vivo y cifras de participación a la derecha.
 */
export function MarketView({
  round,
  price,
  accumulated,
  uniqueInvestors,
  children,
}: MarketViewProps) {
  const { startup } = round;

  return (
    <section className={styles.split} aria-label={`Mercado de la ronda ${round.number}`}>
      <div className={styles.column}>
        <p className={styles.eyebrow}>
          ODS {startup.sdg.number}: {startup.sdg.name}
        </p>
        <h1 className={styles.title}>{startup.name}</h1>
        {children}
      </div>
      <div className={styles.column}>
        <GradientCard className={styles.priceFrame} panelClassName={styles.pricePanel}>
          <p className={styles.cardLabel}>Precio en vivo</p>
          <p className={styles.figurePrice} aria-label={`Precio ${formatPrice(price)}`}>
            {formatPrice(price)}
          </p>
        </GradientCard>
        <div className={styles.grid2}>
          <div className={styles.card}>
            <StatBlock
              label="Monto acumulado"
              value={`${formatInteger(accumulated)} IC`}
              size="lg"
            />
          </div>
          <div className={styles.card}>
            <StatBlock label="Inversores" value={formatInteger(uniqueInvestors)} size="lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

interface MarketPhaseProps {
  vm: OpenMarket;
}

/** Fase Mercado abierto: startup, precio en vivo, monto acumulado e inversores únicos. */
export function MarketPhase({ vm }: MarketPhaseProps) {
  return (
    <MarketView
      round={vm.round}
      price={vm.price}
      accumulated={vm.accumulated}
      uniqueInvestors={vm.uniqueInvestors}
    />
  );
}
