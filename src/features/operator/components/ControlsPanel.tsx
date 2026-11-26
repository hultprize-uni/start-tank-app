"use client";

import { Button } from "@/shared/ui";

import { ManualSettlementPanel } from "./ManualSettlementPanel";
import panel from "./Panel.module.css";

interface ControlsPanelProps {
  onOpenResetEvent: () => void;
  canManualSettle: boolean;
  /** Solo el conductor liquida a mano; el soporte puede exportar. */
  canWrite: boolean;
  onExport: () => void;
  onManualSettle: (
    score: number,
    reason: string,
  ) => Promise<{ multiplier: number } | { error: string }>;
}

/** Controles del operador: exportación de saldos, liquidación manual (RF-31, tarea 5.6) y reinicio total. */
export function ControlsPanel({
  canManualSettle,
  canWrite,
  onExport,
  onManualSettle,
  onOpenResetEvent,
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
          <Button variant="ghost" onClick={onExport}>
            Exportar saldos y posiciones
          </Button>
          <p className={panel.note}>CSV con el saldo de cada asistente y sus posiciones por ronda.</p>
        </div>
        {canWrite ? (
          <ManualSettlementPanel available={canManualSettle} onSettle={onManualSettle} />
        ) : null}
        {canWrite ? (
          <div className={panel.controlItem}>
            <Button variant="danger" onClick={onOpenResetEvent}>
              Reiniciar evento completo…
            </Button>
            <p className={panel.note}>
              Caso extremo: borra inversiones, notas, posiciones y log, y devuelve los saldos al capital
              inicial.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
