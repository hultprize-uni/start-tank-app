"use client";

import { PENDING_API_NOTE } from "../labels";
import panel from "./Panel.module.css";

interface ManualSettlementPanelProps {
  enabled: boolean;
  /** Jurados que respaldan la startup en el modo manual. */
  backs: number;
  jurySize: number;
  /** Indica si el modo manual puede activarse en el estado actual de la ronda. */
  available: boolean;
  apiPending: boolean;
  onToggle: (enabled: boolean) => void;
  onSetBacks: (backs: number) => void;
}

/**
 * Modo manual: interruptor y selección de los jurados que respaldan. Con el modo activo, el
 * veredicto se desbloquea y se calcula con la cantidad indicada.
 */
export function ManualSettlementPanel({
  enabled,
  backs,
  jurySize,
  available,
  apiPending,
  onToggle,
  onSetBacks,
}: ManualSettlementPanelProps) {
  const options = Array.from({ length: jurySize + 1 }, (_, index) => index);

  return (
    <div className={panel.controlItem}>
      <div className={panel.toggleRow}>
        <div>
          <p id="modo-manual-titulo" className={panel.title}>
            Modo manual
          </p>
          <p id="modo-manual-ayuda" className={panel.note}>
            Ingresa el resultado a mano si falla el voto digital.
          </p>
          {apiPending ? (
            <p id="modo-manual-pendiente" className={panel.note}>
              {PENDING_API_NOTE}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="modo-manual-titulo"
          aria-describedby={apiPending ? "modo-manual-pendiente" : "modo-manual-ayuda"}
          disabled={!available}
          onClick={() => onToggle(!enabled)}
          className={enabled ? `${panel.switch} ${panel.switchOn}` : panel.switch}
        >
          <span className={panel.switchThumb} aria-hidden="true" />
        </button>
      </div>

      {enabled ? (
        <fieldset className={panel.backsGroup}>
          <legend className={panel.backsLegend}>Jurados que respaldan</legend>
          <div className={panel.backsOptions}>
            {options.map((option) => {
              const selected = option === backs;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  className={
                    selected
                      ? `${panel.backsOption} ${panel.backsOptionSelected}`
                      : panel.backsOption
                  }
                  onClick={() => onSetBacks(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
