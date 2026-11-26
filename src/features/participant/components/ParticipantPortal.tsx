"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatedBackground, StartTankLoader, Toast } from "@/shared/ui";
import { LOADER_MIN_MS, useMinDelay } from "@/shared/lib/use-min-delay";
import { formatCoins } from "../format";
import { useInvestSheet } from "../hooks/useInvestSheet";
import { DESKTOP_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import { useParticipantState } from "../hooks/useParticipantState";
import { usePortalToast } from "../hooks/usePortalToast";
import { investmentConfirmedMessage } from "../messages";
import type { InvestmentResult, ParticipantViewModel } from "../types";
import { FinalScreen } from "./FinalScreen";
import { InvestModal } from "./InvestModal";
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
function renderRoundScreen(vm: ParticipantViewModel, onInvest: () => void): ReactNode {
  const { round, startup, wallet, market, verdict, standing } = vm;

  switch (vm.phase) {
    case "login":
      return null;
    case "scheduled":
    case "pitch":
      return round && startup && wallet ? (
        <ScheduledScreen
          pitch={vm.phase === "pitch"}
          round={round}
          startup={startup}
          balance={wallet.balance}
          streak={standing?.streak ?? 0}
        />
      ) : null;
    case "open":
    case "lastCall":
      return round && startup && wallet && market ? (
        <MarketScreen
          round={round}
          startup={startup}
          market={market}
          wallet={wallet}
          lastCall={vm.phase === "lastCall"}
          clock={vm.clock}
          onInvest={onInvest}
        />
      ) : null;
    case "voting":
      return round && startup && wallet ? (
        <VotingScreen round={round} startup={startup} wallet={wallet} />
      ) : null;
    case "result":
      return round && startup && verdict && wallet ? (
        <ResultScreen round={round} startup={startup} verdict={verdict} balance={wallet.balance} />
      ) : null;
    case "final":
      return wallet && standing ? (
        <FinalScreen balance={wallet.balance} standing={standing} winnerStartup={vm.winnerStartup} />
      ) : null;
  }
}

/**
 * Contenedor del portal del inversionista. Conecta el estado con el shell responsive, las pantallas y
 * los paneles. En el móvil la inversión abre una hoja inferior; en el escritorio, un panel en línea.
 */
export function ParticipantPortal() {
  const { vm, status, errorMessage, actions } = useParticipantState();
  const ready = useMinDelay(vm !== null, LOADER_MIN_MS);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const { toast, showToast } = usePortalToast();

  const canInvest =
    vm !== null &&
    (vm.phase === "open" || vm.phase === "lastCall") &&
    vm.wallet?.alreadyInvested === false &&
    vm.clock?.paused !== true;
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

  if (vm === null || !ready) {
    return (
      <main className={styles.portal}>
        <AnimatedBackground />
        {status === "error" && errorMessage !== null ? (
          <p className={styles.status} role="status">
            {errorMessage}
          </p>
        ) : (
          <div className={styles.loading}>
            <StartTankLoader label="Cargando..." />
          </div>
        )}
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
  const showRanking = vm.standing !== null;
  const isRevealed = vm.phase === "result" || vm.phase === "final";

  return (
    <main className={styles.portal}>
      <AnimatedBackground />

      <ParticipantShell
        isDesktop={isDesktop}
        header={<PortalHeader balance={balance} />}
        sidebar={<PortalSidebar balance={balance} rounds={vm.rounds} />}
        primary={renderRoundScreen(vm, sheet.open)}
        secondary={
          <>
            {showRanking && vm.standing ? (
              <RankingPanel standing={vm.standing} showDelta={isRevealed} />
            ) : null}
            <RoundHistory rounds={vm.rounds} />
          </>
        }
      />

      {vm.startup && vm.wallet ? (
        <InvestModal
          open={sheet.isOpen}
          onClose={sheet.close}
          startup={vm.startup}
          wallet={vm.wallet}
          isDesktop={isDesktop}
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
