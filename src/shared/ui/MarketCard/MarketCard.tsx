import type { ReactNode } from "react";
import { GradientCard } from "../GradientCard";
import { StatBlock } from "../StatBlock";
import styles from "./MarketCard.module.css";

export interface MarketCardProps {
  /** Nombre de la startup o del elemento principal de la tarjeta. */
  name: ReactNode;
  /** Objetivo de Desarrollo Sostenible asociado a la startup. */
  ods: ReactNode;
  /** Precio actual, en la unidad del evento. */
  price: ReactNode;
  /** Variación del precio, por ejemplo "+4 %". */
  delta: ReactNode;
  /** Tono de la variación. "positive" usa el cian de la marca y "negative" el rosa. Predeterminado: "positive". */
  deltaTone?: "positive" | "negative";
  /** Monto acumulado invertido en la startup. */
  total: ReactNode;
  /** Etiqueta del monto acumulado. */
  totalLabel: ReactNode;
  /** Cantidad de inversores. */
  investors: ReactNode;
  /** Etiqueta de la cantidad de inversores. */
  investorsLabel: ReactNode;
  /** Indicador de estado, por ejemplo una insignia en vivo. Se omite si no se recibe. */
  status?: ReactNode;
  /** Texto de la ronda, por ejemplo "Ronda 3 de 5". Se omite si no se recibe. */
  roundLabel?: ReactNode;
  /** Nivel del encabezado que contiene el nombre. Predeterminado: 3. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/**
 * Tarjeta de mercado que muestra el precio y los datos de una startup durante una ronda.
 * Se compone de GradientCard y StatBlock. Todos los textos llegan por props.
 */
export function MarketCard({
  name,
  ods,
  price,
  delta,
  deltaTone = "positive",
  total,
  totalLabel,
  investors,
  investorsLabel,
  status,
  roundLabel,
  headingLevel = 3,
  className,
}: MarketCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const deltaClass = [
    styles.delta,
    deltaTone === "negative" ? styles.deltaNegative : styles.deltaPositive,
  ].join(" ");
  const cardClass = [styles.card, className].filter(Boolean).join(" ");

  return (
    <GradientCard as="article" glow className={cardClass} panelClassName={styles.panel}>
      {status || roundLabel ? (
        <div className={styles.header}>
          {status ? <div className={styles.status}>{status}</div> : <span />}
          {roundLabel ? <span className={styles.round}>{roundLabel}</span> : null}
        </div>
      ) : null}

      <Heading className={styles.name}>{name}</Heading>
      <p className={styles.ods}>{ods}</p>

      <div className={styles.priceRow}>
        <span className={styles.price}>{price}</span>
        <span className={deltaClass}>{delta}</span>
      </div>

      <div className={styles.totals}>
        <StatBlock label={totalLabel} value={total} />
        <StatBlock label={investorsLabel} value={investors} />
      </div>
    </GradientCard>
  );
}
