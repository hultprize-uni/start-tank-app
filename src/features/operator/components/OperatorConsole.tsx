"use client";

import { Badge, Eyebrow, type BadgeTone } from "@/shared/ui";

import { ROUND_STATUS_LABELS } from "../labels";
import type {
  CancelMode,
  OperatorActionId,
  OperatorViewModel,
  RoundStatus,
  TimerCommand,
} from "../types";

import { ActionLogPanel } from "./ActionLogPanel";
import { ActionsPanel } from "./ActionsPanel";
import { CancelRoundDialog } from "./CancelRoundDialog";
import { ControlsPanel } from "./ControlsPanel";
import { JurorVotesPanel } from "./JurorVotesPanel";
import { MarketPanel } from "./MarketPanel";
import { PhaseTimer } from "./PhaseTimer";
import { RescueRevealDialog } from "./RescueRevealDialog";
import { RestartDialog } from "./RestartDialog";
import { RoundSteps } from "./RoundSteps";
import { StandingsPanel } from "./StandingsPanel";
import styles from "./Admin.module.css";

/** Entradas del log visibles en la consola. El log completo tiene su propia sección. */
const CONSOLE_LOG_ENTRIES = 6;

function toneOf(status: RoundStatus): BadgeTone {
  if (status === "VOTING") return "pink";
  if (status === "PITCH" || status === "OPEN" || status === "LAST_CALL") return "cyan";
  return "yellow";
}

function isLive(status: RoundStatus): boolean {
  return status === "PITCH" || status === "OPEN" || status === "LAST_CALL" || status === "VOTING";
}

export type ConsoleDialog = "cancel" | "rescue" | "restart_round" | "reset_event" | null;

interface OperatorConsoleProps {
  viewModel: OperatorViewModel;
  busy: boolean;
  /** Diálogo abierto. Lo controla el portal para que las alertas puedan abrir el rescate. */
  dialog: ConsoleDialog;
  onDialog: (dialog: ConsoleDialog) => void;
  onRun: (id: OperatorActionId) => void;
  onTimer: (command: TimerCommand) => void;
  onCancel: (mode: CancelMode, reason: string) => Promise<string | null>;
  onRestartRound: (reason: string) => Promise<string | null>;
  onResetEvent: () => Promise<string | null>;
  onRescue: (reason: string) => Promise<string | null>;
  onManualSettle: (
    score: number,
    reason: string,
  ) => Promise<{ multiplier: number } | { error: string }>;
  onExport: () => void;
}

/**
 * Consola del conductor (HU-11, HU-12, HU-13): la startup en escena, el cronómetro de la fase,
 * los pasos de la ronda con un único botón válido, el mercado y los jurados en vivo. El soporte ve
 * lo mismo en solo lectura (RF-03).
 */
export function OperatorConsole({
  viewModel,
  busy,
  dialog,
  onDialog,
  onRun,
  onTimer,
  onCancel,
  onRescue,
  onRestartRound,
  onResetEvent,
  onManualSettle,
  onExport,
}: OperatorConsoleProps) {
  const { round, market, jurors, standings, log, operator, event } = viewModel;
  const canWrite = operator.role === "CONDUCTOR";

  return (
    <>
      {event.manualMode ? (
        <p className={styles.manualBanner} role="status">
          Modo manual activo: el ranking está congelado en la ronda{" "}
          {event.lastSettledRound?.number ?? "—"}.
        </p>
      ) : null}
      {!canWrite ? (
        <p className={styles.readOnly}>
          Estás como soporte: puedes ver todo, pero las acciones las ejecuta el conductor.
        </p>
      ) : null}

      <header className={styles.consoleHeader}>
        <div className={styles.roundIdentity}>
          <div className={styles.roundBadges}>
            <Badge tone={toneOf(round.status)} live={isLive(round.status)}>
              {ROUND_STATUS_LABELS[round.status]}
            </Badge>
            <Eyebrow as="span">
              Ronda {round.number} de {round.total}
            </Eyebrow>
          </div>
          <h1 className={styles.roundTitle}>{round.startupName}</h1>
          <RoundSteps steps={viewModel.steps} />
        </div>
        <PhaseTimer
          status={round.status}
          clock={viewModel.clock}
          schedule={viewModel.schedule}
          adjustable={viewModel.timerAdjustable}
          canControl={canWrite}
          busy={busy}
          onCommand={onTimer}
        />
      </header>

      {canWrite ? (
        <ActionsPanel
          viewModel={viewModel}
          busy={busy}
          onRun={onRun}
          onOpenCancel={() => onDialog("cancel")}
          onOpenRescue={() => onDialog("rescue")}
          onOpenRestart={() => onDialog("restart_round")}
        />
      ) : null}

      <MarketPanel market={market} />

      <div className={styles.consoleGrid}>
        <div className={styles.column}>
          <JurorVotesPanel jurors={jurors} />
          <StandingsPanel standings={standings} />
        </div>
        <div className={styles.column}>
          <ActionLogPanel entries={log} limit={CONSOLE_LOG_ENTRIES} />
          <ControlsPanel
            canWrite={canWrite}
            canManualSettle={viewModel.canManualSettle}
            onExport={onExport}
            onManualSettle={onManualSettle}
            onOpenResetEvent={() => onDialog("reset_event")}
          />
        </div>
      </div>

      {dialog === "cancel" && canWrite && viewModel.canCancel ? (
        <CancelRoundDialog
          roundNumber={round.number}
          startupName={round.startupName}
          onClose={() => onDialog(null)}
          onConfirm={onCancel}
        />
      ) : null}
      {dialog === "rescue" && canWrite && viewModel.canRescue ? (
        <RescueRevealDialog jurors={jurors} onClose={() => onDialog(null)} onConfirm={onRescue} />
      ) : null}
      {dialog === "restart_round" && canWrite && viewModel.restartRound !== null ? (
        <RestartDialog
          title={`¿Reiniciar la ronda ${viewModel.restartRound.number}?`}
          description={`${viewModel.restartRound.startupName} vuelve a Programada: se devuelve lo invertido a cada asistente y se borran sus inversiones, notas del jurado y posiciones de esa ronda.`}
          confirmLabel="Reiniciar ronda"
          onClose={() => onDialog(null)}
          onConfirm={onRestartRound}
        />
      ) : null}
      {dialog === "reset_event" && canWrite ? (
        <RestartDialog
          title="¿Reiniciar todo el evento?"
          description="Se borran todas las inversiones, notas, posiciones y el log de acciones. Todas las rondas vuelven a Programada y cada asistente vuelve al capital inicial. Se guarda un respaldo antes de borrar."
          confirmLabel="Reiniciar evento"
          confirmWord="REINICIAR"
          onClose={() => onDialog(null)}
          onConfirm={() => onResetEvent()}
        />
      ) : null}
    </>
  );
}
