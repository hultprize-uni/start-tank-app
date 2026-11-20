"use client";

import { Button } from "@/shared/ui";

import { PENDING_API_NOTE } from "../labels";

import { ManualSettlementPanel } from "./ManualSettlementPanel";
import panel from "./Panel.module.css";

interface ControlsPanelProps {
  canUndo: boolean;
  canCancel: boolean;
  canManualSettle: boolean;
  /** Indica si la consola opera contra la API, donde deshacer aún no existe. */
  apiPending: boolean;
  onUndo: () => void;
  onOpenCancel: () => void;
  onExport: () => void;
}

/** Controles del operador: deshacer, anular, exportar y liquidación manual. */
export function ControlsPanel({
  canUndo,
  canCancel,
  canManualSettle,
  apiPending,
  onUndo,
  onOpenCancel,
  onExport,
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
        <ManualSettlementPanel available={canManualSettle} />
      </div>
    </section>
  );
}
