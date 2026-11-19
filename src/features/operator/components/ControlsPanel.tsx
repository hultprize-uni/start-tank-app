"use client";

import { Button } from "@/shared/ui";

import { PENDING_API_NOTE } from "../labels";
import type { ManualModeView } from "../types";

import { ManualSettlementPanel } from "./ManualSettlementPanel";
import panel from "./Panel.module.css";

interface ControlsPanelProps {
  canUndo: boolean;
  canCancel: boolean;
  canManualSettle: boolean;
  manualMode: ManualModeView;
  /** Número de jurados. Define las opciones de respaldo del modo manual. */
  jurySize: number;
  /** Indica si la consola opera contra la API, donde deshacer y el modo manual aún no existen. */
  apiPending: boolean;
  onUndo: () => void;
  onOpenCancel: () => void;
  onExport: () => void;
  onToggleManual: (enabled: boolean) => void;
  onSetManualBacks: (backs: number) => void;
}

/** Controles del operador: deshacer, anular, exportar y modo manual. */
export function ControlsPanel({
  canUndo,
  canCancel,
  canManualSettle,
  manualMode,
  jurySize,
  apiPending,
  onUndo,
  onOpenCancel,
  onExport,
  onToggleManual,
  onSetManualBacks,
}: ControlsPanelProps) {
  return (
    <section className={panel.panel} aria-labelledby="controles-operador">
      <div className={panel.header}>
        <h2 id="controles-operador" className={panel.title}>
          Controles del operador
        </h2>
      </div>
      <div className={panel.controls}>
        <div className={panel.controlItem}>
          <Button
            variant="ghost"
            disabled={!canUndo}
            aria-describedby={apiPending ? "nota-deshacer" : undefined}
            onClick={onUndo}
          >
            Deshacer última acción
          </Button>
          {apiPending ? (
            <p id="nota-deshacer" className={panel.note}>
              {PENDING_API_NOTE}
            </p>
          ) : null}
        </div>
        <div className={panel.controlItem}>
          <Button variant="danger" disabled={!canCancel} onClick={onOpenCancel}>
            Anular ronda…
          </Button>
        </div>
        <div className={panel.controlItem}>
          <Button variant="ghost" onClick={onExport}>
            Exportar saldos
          </Button>
        </div>
        <ManualSettlementPanel
          enabled={manualMode.enabled}
          backs={manualMode.backs}
          jurySize={jurySize}
          available={canManualSettle}
          apiPending={apiPending}
          onToggle={onToggleManual}
          onSetBacks={onSetManualBacks}
        />
      </div>
    </section>
  );
}
