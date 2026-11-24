"use client";

import { Button } from "@/shared/ui";

import type { OperatorActionId, OperatorViewModel } from "../types";

import { CloseEventPanel } from "./CloseEventPanel";
import { MainActionButton } from "./MainActionButton";
import styles from "./Admin.module.css";

interface ActionsPanelProps {
  viewModel: OperatorViewModel;
  busy: boolean;
  onRun: (id: OperatorActionId) => void;
  onOpenCancel: () => void;
  onOpenRescue: () => void;
}

/**
 * Acciones del conductor sobre la ronda: el botón principal con el único paso válido (RF-06),
 * Anular ronda (RF-10) y, en la votación con envíos pendientes, revelar con los presentes (RF-18).
 * Con todas las rondas terminadas ofrece el cierre del evento (RF-30).
 */
export function ActionsPanel({
  viewModel,
  busy,
  onRun,
  onOpenCancel,
  onOpenRescue,
}: ActionsPanelProps) {
  const { mainAction } = viewModel;

  if (mainAction === null) {
    return viewModel.canCloseEvent ? <CloseEventPanel /> : null;
  }

  return (
    <div className={styles.mainRow}>
      <MainActionButton action={mainAction} busy={busy} onRun={onRun} />
      {viewModel.canRescue ? (
        <Button variant="ghost" size="lg" disabled={busy} onClick={onOpenRescue}>
          Revelar con presentes…
        </Button>
      ) : null}
      {viewModel.canCancel ? (
        <Button variant="danger" size="lg" disabled={busy} onClick={onOpenCancel}>
          Anular ronda…
        </Button>
      ) : null}
    </div>
  );
}
