"use client";

import { useEffect, useState } from "react";
import { type InvestorActions, useInvestorState } from "@/lib/api/investor.mock";
import type { InvestorViewModel } from "@/lib/api/investor.types";
import { FinalScreen } from "./FinalScreen";
import { formatCoins } from "./format";
import { InvestSheet } from "./InvestSheet";
import { LoginScreen } from "./LoginScreen";
import { MarketScreen } from "./MarketScreen";
import { PortalHeader } from "./PortalHeader";
import { ResultScreen } from "./ResultScreen";
import { ScheduledScreen } from "./ScheduledScreen";
import { Toast } from "./Toast";
import { VotingScreen } from "./VotingScreen";
import styles from "./InvestorPortal.module.css";

const TOAST_DURATION_MS = 2_600;

/** Pantalla del inversionista según la fase de la ronda. Las pantallas no tienen estado propio. */
function renderScreen(
  vm: InvestorViewModel,
  actions: InvestorActions,
  onInvest: () => void,
): React.ReactNode {
  const { round, startup, wallet, market, verdict, standing } = vm;

  switch (vm.phase) {
    case "login":
      return <LoginScreen onLogin={actions.login} />;
    case "scheduled":
      return round && startup ? <ScheduledScreen round={round} startup={startup} /> : null;
    case "open":
    case "lastCall":
      return round && startup && wallet && market ? (
        <MarketScreen
          round={round}
          startup={startup}
          market={market}
          wallet={wallet}
          countdownSeconds={vm.countdownSeconds}
          onInvest={onInvest}
        />
      ) : null;
    case "voting":
      return round && startup && wallet ? (
        <VotingScreen round={round} startup={startup} wallet={wallet} />
      ) : null;
    case "result":
      return round && startup && verdict && standing ? (
        <ResultScreen round={round} startup={startup} verdict={verdict} standing={standing} />
      ) : null;
    case "final":
      return wallet && standing ? <FinalScreen balance={wallet.balance} standing={standing} /> : null;
  }
}

/** Contenedor del portal del inversionista: conecta el estado de la simulación con las pantallas. */
export function InvestorPortal() {
  const { vm, actions } = useInvestorState();
  /** Número de ronda para la que la hoja Invertir fue abierta. Evita reabrirla en la siguiente ronda. */
  const [sheetRound, setSheetRound] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canInvest = vm.phase === "open" || vm.phase === "lastCall";
  const isSheetVisible =
    canInvest && vm.round !== null && sheetRound === vm.round.number;

  useEffect(() => {
    if (toast === null) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openSheet = () => {
    if (vm.round) setSheetRound(vm.round.number);
  };

  const closeSheet = () => setSheetRound(null);

  const confirmInvestment = (amount: number) => {
    actions.invest(amount);
    setSheetRound(null);
    setToast(`Inversión confirmada · −${formatCoins(amount)}`);
  };

  return (
    <main className={styles.portal}>
      {vm.phase !== "login" && <PortalHeader balance={vm.wallet?.balance ?? null} />}

      <div className={styles.content}>{renderScreen(vm, actions, openSheet)}</div>

      {isSheetVisible && vm.startup && vm.wallet && (
        <InvestSheet
          startupName={vm.startup.name}
          wallet={vm.wallet}
          onConfirm={confirmInvestment}
          onClose={closeSheet}
        />
      )}

      {toast !== null && <Toast message={toast} />}
    </main>
  );
}
