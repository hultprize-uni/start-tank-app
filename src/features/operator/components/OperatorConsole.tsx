"use client";

import { useState } from "react";

import { AnimatedBackground, Toast } from "@/shared/ui";

import type { CancelMode, OperatorActionId, OperatorViewModel } from "../types";

import { ActionLogPanel } from "./ActionLogPanel";
import { ActionsPanel } from "./ActionsPanel";
import { CancelRoundDialog } from "./CancelRoundDialog";
import { ControlsPanel } from "./ControlsPanel";
import { JurorVotesPanel } from "./JurorVotesPanel";
import { MarketPanel } from "./MarketPanel";
import { OperatorSidebar } from "./OperatorSidebar";
import { RoundHeader } from "./RoundHeader";
import { StandingsPanel } from "./StandingsPanel";
import { WinnerBanner } from "./WinnerBanner";
import styles from "./OperatorConsole.module.css";

interface OperatorConsoleProps {
  viewModel: OperatorViewModel;
  /** Aviso de la última operación fallida o pendiente de API. */
  notice: string | null;
  /** Indica si la consola usa los datos de muestra. Solo en ese modo se simulan votos. */
  sampleMode: boolean;
  onRunAction: (id: OperatorActionId) => void;
  onUndo: () => void;
  onCancelRound: (mode: CancelMode) => void;
  onSimulateJurorVote: (jurorId: string) => void;
  onExport: () => void;
  onLogout: () => void;
}

/** Consola de la ronda del operador en laptop. Compone la barra lateral, los paneles y el diálogo de anulación. */
export function OperatorConsole({
  viewModel,
  notice,
  sampleMode,
  onRunAction,
  onUndo,
  onCancelRound,
  onSimulateJurorVote,
  onExport,
  onLogout,
}: OperatorConsoleProps) {
  const [cancelOpen, setCancelOpen] = useState(false);

  const { round, rounds, actions, jurors, market, standings, log } = viewModel;
  const winner =
    round.number === round.total && round.status === "SETTLED" ? standings[0] : undefined;

  return (
    <div className={styles.page}>
      <AnimatedBackground />
      <div className={styles.shell}>
        <OperatorSidebar
          rounds={rounds}
          currentRound={round.number}
          connectedAttendees={market.connectedAttendees}
          onLogout={onLogout}
        />

        <main className={styles.main}>
          <RoundHeader
            round={round}
            lastCallRemaining={market.lastCallRemaining}
            connectedAttendees={market.connectedAttendees}
          />

          {notice !== null ? (
            <Toast tone="warning" role="alert">
              {notice}
            </Toast>
          ) : null}

          {winner !== undefined ? (
            <WinnerBanner name={winner.startupName} score={winner.score} />
          ) : null}

          <div className={styles.grid}>
            <div className={styles.column}>
              <ActionsPanel
                actions={actions}
                roundStatus={round.status}
                onRunAction={onRunAction}
              />
              <ControlsPanel
                canUndo={viewModel.canUndo}
                canCancel={viewModel.canCancel}
                canManualSettle={viewModel.canManualSettle}
                apiPending={!sampleMode}
                onUndo={onUndo}
                onOpenCancel={() => setCancelOpen(true)}
                onExport={onExport}
              />
            </div>

            <div className={styles.column}>
              <JurorVotesPanel
                jurors={jurors}
                canSimulateVote={round.status === "VOTING" && sampleMode}
                onSimulateVote={onSimulateJurorVote}
              />
              <MarketPanel market={market} multiplier={round.multiplier} />
              <StandingsPanel standings={standings} />
              <ActionLogPanel entries={log} />
            </div>
          </div>
        </main>
      </div>

      {cancelOpen && viewModel.canCancel ? (
        <CancelRoundDialog
          roundNumber={round.number}
          startupName={round.startupName}
          onClose={() => setCancelOpen(false)}
          onConfirm={(mode) => {
            setCancelOpen(false);
            onCancelRound(mode);
          }}
        />
      ) : null}
    </div>
  );
}
