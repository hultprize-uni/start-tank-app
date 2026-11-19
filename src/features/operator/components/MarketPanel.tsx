import { StatBlock } from "@/shared/ui";

import { formatCoins, formatMultiplier } from "../labels";
import type { MarketView } from "../types";

import panel from "./Panel.module.css";

interface MarketPanelProps {
  market: MarketView;
  /** Multiplicador de la ronda. Es null mientras la ronda no esté liquidada. */
  multiplier: number | null;
}

/** Resumen del mercado de la ronda: precio en vivo, monto acumulado, inversores y multiplicador. */
export function MarketPanel({ market, multiplier }: MarketPanelProps) {
  return (
    <section className={panel.panel} aria-labelledby="mercado-ronda">
      <div className={panel.header}>
        <h2 id="mercado-ronda" className={panel.title}>
          Mercado
        </h2>
      </div>
      <div className={panel.statGrid}>
        <StatBlock label="Precio en vivo" value={formatCoins(market.price)} size="lg" />
        <StatBlock
          label="Acumulado"
          value={
            <>
              {formatCoins(market.accumulated)} <span className={panel.muted}>coins</span>
            </>
          }
          size="lg"
        />
        <StatBlock
          label="Inversores únicos"
          value={
            <>
              {formatCoins(market.uniqueInvestors)}{" "}
              <span className={panel.muted}>de {formatCoins(market.connectedAttendees)}</span>
            </>
          }
          size="lg"
        />
        <StatBlock
          label="Multiplicador"
          value={multiplier === null ? "—" : formatMultiplier(multiplier)}
          size="lg"
        />
      </div>
    </section>
  );
}
