"use client";

import { useState } from "react";

import { loginOperator, OPERATOR_SESSION_EXPIRED_MESSAGE } from "../api/client";
import { useOperatorState } from "../hooks/useOperatorState";
import { USE_MOCKS } from "@/shared/lib/env";

import { AccessGate } from "./AccessGate";
import { OperatorConsole } from "./OperatorConsole";
import gateStyles from "./AccessGate.module.css";

/** Punto de entrada del portal del operador: controla el acceso con código y monta la consola. */
export function OperatorPortal() {
  const [authorized, setAuthorized] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!authorized) {
    return (
      <AccessGate
        notice={notice}
        onSubmit={async (code) => {
          const error = await loginOperator(code);
          if (error === null) {
            setNotice(null);
            setAuthorized(true);
          }
          return error;
        }}
      />
    );
  }

  return (
    <OperatorWorkspace
      onExpired={() => {
        setNotice(OPERATOR_SESSION_EXPIRED_MESSAGE);
        setAuthorized(false);
      }}
    />
  );
}

interface OperatorWorkspaceProps {
  /** Devuelve al acceso con código cuando la sesión deja de ser válida. */
  onExpired: () => void;
}

/** Conecta el estado de la ronda con la consola. Solo se monta tras el acceso. */
function OperatorWorkspace({ onExpired }: OperatorWorkspaceProps) {
  const operator = useOperatorState({ onSessionExpired: onExpired });
  const { viewModel, notice } = operator;

  if (viewModel === null) {
    return (
      <main className={gateStyles.page}>
        <p className={gateStyles.lead} role="status">
          {notice ?? "Cargando la ronda..."}
        </p>
      </main>
    );
  }

  return (
    <OperatorConsole
      viewModel={viewModel}
      notice={notice}
      sampleMode={USE_MOCKS}
      onRunAction={operator.runAction}
      onUndo={operator.undo}
      onCancelRound={operator.cancelRound}
      onManualSettlement={operator.settleManually}
      onSimulateJurorVote={operator.simulateJurorVote}
      onExport={operator.exportCsv}
    />
  );
}
