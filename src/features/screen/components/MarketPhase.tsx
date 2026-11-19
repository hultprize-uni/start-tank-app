import type { OpenMarket } from "../types";
import { RoundHeader } from "./RoundHeader";
import { MarketMetrics } from "./MarketMetrics";

interface MarketPhaseProps {
  vm: OpenMarket;
}

/** Fase Mercado abierto: startup, ODS, precio en vivo, monto acumulado e inversores unicos. */
export function MarketPhase({ vm }: MarketPhaseProps) {
  return (
    <>
      <RoundHeader round={vm.round} />
      <MarketMetrics
        price={vm.price}
        accumulated={vm.accumulated}
        uniqueInvestors={vm.uniqueInvestors}
      />
    </>
  );
}
