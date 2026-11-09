"use client";

import { useEffect, useState } from "react";
import { useInvestorState } from "@/lib/api/investor.state";
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
function renderScreen(vm: InvestorViewModel, onInvest: () => void): React.ReactNode {
  const { round, startup, wallet, market, verdict, standing } = vm;

  switch (vm.phase) {
    case "login":
      return <LoginScreen />;
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

/** Contenedor del portal del inversionista: conecta el estado del servidor con las pantallas. */
export function InvestorPortal() {
  const { vm, status, errorMessage, actions } = useInvestorState();
  /** Número de ronda para la que la hoja Invertir fue abierta. Evita reabrirla en la siguiente ronda. */
  const [sheetRound, setSheetRound] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canInvest = vm !== null && (vm.phase === "open" || vm.phase === "lastCall");
  const ronda = vm?.round ?? null;
  const isSheetVisible = canInvest && ronda !== null && sheetRound === ronda.number;

  useEffect(() => {
    if (toast === null) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (errorMessage !== null) setToast(errorMessage);
  }, [errorMessage]);

  const openSheet = () => {
    if (ronda) setSheetRound(ronda.number);
  };

  const closeSheet = () => setSheetRound(null);

  const confirmInvestment = async (amount: number) => {
    setSheetRound(null);
    const resultado = await actions.invest(amount);
    setToast(resultado.ok ? `Inversión confirmada · −${formatCoins(amount)}` : resultado.mensaje);
  };

  const mensajeEstado = status === "error" && errorMessage !== null ? errorMessage : "Cargando...";

  return (
    <main className={styles.portal}>
      {vm !== null && vm.phase !== "login" && <PortalHeader balance={vm.wallet?.balance ?? null} />}

      <div className={styles.content}>
        {vm !== null ? (
          renderScreen(vm, openSheet)
        ) : (
          <p className={styles.loading} role="status">
            {mensajeEstado}
          </p>
        )}
      </div>

      {isSheetVisible && vm?.startup && vm.wallet && (
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
