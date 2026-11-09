"use client";

import { useState } from "react";

import { useOperatorState, verifyOperatorCode } from "@/lib/api/operator.mock";
import { buildSettlementCsv, downloadCsv } from "@/lib/api/operator.export";

import { AccessGate } from "./AccessGate";
import { OperatorConsole } from "./OperatorConsole";

/** Punto de entrada del portal del operador: controla el acceso con código y monta la consola. */
export function OperatorPortal() {
  const [authorized, setAuthorized] = useState(false);

  if (!authorized) {
    return (
      <AccessGate
        onSubmit={(code) => {
          const valid = verifyOperatorCode(code);
          if (valid) {
            setAuthorized(true);
          }
          return valid;
        }}
      />
    );
  }

  return <OperatorWorkspace />;
}

/** Conecta el estado mock de la ronda con la consola. Solo se monta tras el acceso. */
function OperatorWorkspace() {
  const operator = useOperatorState();
  const { viewModel } = operator;

  function handleExport() {
    downloadCsv(
      `start-tank-ronda-${viewModel.round.number}-saldos-posiciones.csv`,
      buildSettlementCsv(viewModel),
    );
  }

  return (
    <OperatorConsole
      viewModel={viewModel}
      onRunAction={operator.runAction}
      onUndo={operator.undo}
      onCancelRound={operator.cancelRound}
      onManualSettlement={operator.settleManually}
      onSimulateJurorVote={operator.simulateJurorVote}
      onExport={handleExport}
    />
  );
}
