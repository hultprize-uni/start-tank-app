"use client";

import { useState } from "react";

import type {
  CancelMode,
  ManualSettlementInput,
  OperatorActionId,
  OperatorViewModel,
} from "@/lib/api/operator.types";

import { ActionLogPanel } from "./ActionLogPanel";
import { ActionsPanel } from "./ActionsPanel";
import { CancelRoundDialog } from "./CancelRoundDialog";
import { JurorVotesPanel } from "./JurorVotesPanel";
import { ManualSettlementPanel } from "./ManualSettlementPanel";
import { MarketPanel } from "./MarketPanel";
import { RoundHeader } from "./RoundHeader";
import { StatusLine } from "./StatusLine";
import styles from "./OperatorConsole.module.css";

interface OperatorConsoleProps {
  viewModel: OperatorViewModel;
  onRunAction: (id: OperatorActionId) => void;
  onUndo: () => void;
  onCancelRound: (mode: CancelMode) => void;
  onManualSettlement: (input: ManualSettlementInput) => void;
  onSimulateJurorVote: (jurorId: string) => void;
  onExport: () => void;
}

/** Consola de la ronda del operador en laptop. Compone los paneles y la barra de herramientas. */
export function OperatorConsole({
  viewModel,
  onRunAction,
  onUndo,
  onCancelRound,
  onManualSettlement,
  onSimulateJurorVote,
  onExport,
}: OperatorConsoleProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { round } = viewModel;
  const votingOpen = round.status === "EN_VOTACION";
  const showManual = manualOpen && viewModel.canManualSettle;
  const showCancel = cancelOpen && viewModel.canCancel;

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <p className="st-eyebrow">Start Tank</p>
          <h1 className={styles.brandTitle}>Portal del operador</h1>
          <span className={styles.operatorTag}>Laptop de operación</span>
        </div>
      </header>

      <RoundHeader
        round={round}
        connectedAttendees={viewModel.market.connectedAttendees}
        screenSynced={viewModel.screenSynced}
      />

      <div className={styles.layout}>
        <div className={styles.column}>
          <section className={styles.panel} aria-labelledby="estado-ronda">
            <div className={styles.panelHeader}>
              <h3 id="estado-ronda" className={styles.panelTitle}>
                Estado de la ronda
              </h3>
            </div>
            <StatusLine status={round.status} />
          </section>
          <ActionsPanel actions={viewModel.actions} onRunAction={onRunAction} />
          <JurorVotesPanel
            jurors={viewModel.jurors}
            canSimulateVote={votingOpen}
            onSimulateVote={onSimulateJurorVote}
          />
        </div>

        <div className={styles.column}>
          <MarketPanel market={viewModel.market} />
          <ActionLogPanel entries={viewModel.log} />
        </div>
      </div>

      <div className={styles.toolbar} role="toolbar" aria-label="Controles del operador">
        <button
          type="button"
          className={styles.button}
          onClick={onUndo}
          disabled={!viewModel.canUndo}
        >
          Deshacer última acción
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonDanger}`}
          onClick={() => setCancelOpen(true)}
          disabled={!viewModel.canCancel}
        >
          Anular ronda…
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => setManualOpen((open) => !open)}
          disabled={!viewModel.canManualSettle}
          aria-expanded={showManual}
          aria-controls="modo-manual"
        >
          Modo manual
        </button>
        <span className={styles.toolbarSpacer} />
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={onExport}
        >
          Exportar saldos y posiciones
        </button>
      </div>

      {showManual ? (
        <ManualSettlementPanel
          onSubmit={(input) => {
            onManualSettlement(input);
            setManualOpen(false);
          }}
          onClose={() => setManualOpen(false)}
        />
      ) : null}

      {showCancel ? (
        <CancelRoundDialog
          roundNumber={round.number}
          startupName={round.startupName}
          onClose={() => setCancelOpen(false)}
          onConfirm={(mode) => {
            onCancelRound(mode);
            setCancelOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
