"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatedBackground, Toast } from "@/shared/ui";
import { formatCoins } from "../format";
import { useInvestSheet } from "../hooks/useInvestSheet";
import { DESKTOP_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import { useParticipantState } from "../hooks/useParticipantState";
import { usePortalToast } from "../hooks/usePortalToast";
import { investmentConfirmedMessage } from "../messages";
import type { InvestmentResult, ParticipantViewModel } from "../types";
import { FinalScreen } from "./FinalScreen";
import { InvestPanel } from "./InvestPanel";
import { InvestSheet } from "./InvestSheet";
import { LoginScreen } from "./LoginScreen";
import { MarketScreen } from "./MarketScreen";
import { ParticipantShell } from "./ParticipantShell";
import { PortalHeader } from "./PortalHeader";
import { PortalSidebar } from "./PortalSidebar";
import { RankingPanel } from "./RankingPanel";
import { ResultScreen } from "./ResultScreen";
import { RoundHistory } from "./RoundHistory";
import { ScheduledScreen } from "./ScheduledScreen";
import { VotingScreen } from "./VotingScreen";
import styles from "./ParticipantPortal.module.css";

/** Pantalla de la ronda según la fase. La pantalla no guarda estado propio. */
function renderRoundScreen(vm: ParticipantViewModel, onInvest: (() => void) | undefined): ReactNode {
  const { round, startup, wallet, market, verdict, standing } = vm;

  switch (vm.phase) {
    case "login":
      return null;
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
      return round && startup && verdict ? (
        <ResultScreen round={round} startup={startup} verdict={verdict} />
      ) : null;
    case "final":
      return wallet && standing ? <FinalScreen balance={wallet.balance} standing={standing} /> : null;
  }
}

/**
 * Contenedor del portal del inversionista. Conecta el estado con el shell responsive, las pantallas y
 * los paneles. En el móvil la inversión abre una hoja inferior; en el escritorio, un panel en línea.
 */
export function ParticipantPortal() {
  const { vm, status, errorMessage, actions } = useParticipantState();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const { toast, showToast } = usePortalToast();

  const canInvest = vm !== null && (vm.phase === "open" || vm.phase === "lastCall");
  const sheet = useInvestSheet(vm?.round?.number ?? null, canInvest);

  useEffect(() => {
    if (errorMessage !== null) showToast(errorMessage, "negative");
  }, [errorMessage, showToast]);

  const confirmInvestment = async (amount: number): Promise<InvestmentResult> => {
    sheet.close();
    const result = await actions.invest(amount);
    if (result.ok) {
      showToast(investmentConfirmedMessage(formatCoins(amount)), "positive");
    } else {
      showToast(result.message, "negative");
    }
    return result;
  };

  if (vm === null) {
    return (
      <main className={styles.portal}>
        <AnimatedBackground />
        <p className={styles.status} role="status">
          {status === "error" && errorMessage !== null ? errorMessage : "Cargando..."}
        </p>
      </main>
    );
  }

  if (vm.phase === "login") {
    return (
      <main className={styles.portal}>
        <AnimatedBackground />
        <LoginScreen isDesktop={isDesktop} />
      </main>
    );
  }

  const balance = vm.wallet?.balance ?? 0;
  const showInlineInvest = isDesktop && canInvest && vm.startup !== null && vm.wallet !== null;
  const showRanking = vm.standing !== null;
  const isRevealed = vm.phase === "result" || vm.phase === "final";

  return (
    <main className={styles.portal}>
      <AnimatedBackground />

      <ParticipantShell
        isDesktop={isDesktop}
        header={<PortalHeader balance={balance} />}
        sidebar={<PortalSidebar balance={balance} rounds={vm.rounds} />}
        primary={renderRoundScreen(vm, isDesktop ? undefined : sheet.open)}
        secondary={
          <>
            {showInlineInvest && vm.startup && vm.wallet ? (
              <InvestPanel
                startupName={vm.startup.name}
                wallet={vm.wallet}
                onConfirm={confirmInvestment}
              />
            ) : null}
            {showRanking && vm.standing ? (
              <RankingPanel standing={vm.standing} showDelta={isRevealed} />
            ) : null}
            <RoundHistory rounds={vm.rounds} />
          </>
        }
      />

      {vm.startup && vm.wallet ? (
        <InvestSheet
          open={sheet.isOpen && !isDesktop}
          onClose={sheet.close}
          startupName={vm.startup.name}
          wallet={vm.wallet}
          onConfirm={confirmInvestment}
        />
      ) : null}

      {toast !== null ? (
        <div className={styles.toastLayer}>
          <Toast tone={toast.tone}>{toast.message}</Toast>
        </div>
      ) : null}
    </main>
  );
}
