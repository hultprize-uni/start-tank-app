"use client";

import { useCallback, useState } from "react";

import { USE_MOCKS } from "@/shared/lib/env";

import { loginOperator, OPERATOR_SESSION_EXPIRED_MESSAGE } from "../api/client";
import { MOCK_OPERATOR_CODE } from "../api/mock";
import { useOperatorState } from "../hooks/useOperatorState";

import { AccessGate } from "./AccessGate";
import { OperatorConsole } from "./OperatorConsole";
import gateStyles from "./AccessGate.module.css";

/** Punto de entrada del portal del operador: controla el acceso con código y monta la consola. */
export function OperatorPortal() {
  const [authorized, setAuthorized] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleLogin = useCallback(async (code: string) => {
    const error = await loginOperator(code);
    if (error === null) {
      setNotice(null);
      setAuthorized(true);
    }
    return error;
  }, []);

  if (!authorized) {
    return (
      <AccessGate
        notice={notice}
        onSubmit={handleLogin}
        demoCode={USE_MOCKS ? MOCK_OPERATOR_CODE : undefined}
      />
    );
  }

  return (
    <OperatorWorkspace
      onExpired={() => {
        setNotice(OPERATOR_SESSION_EXPIRED_MESSAGE);
        setAuthorized(false);
      }}
      onLogout={() => {
        setNotice(null);
        setAuthorized(false);
      }}
    />
  );
}

interface OperatorWorkspaceProps {
  /** Devuelve al acceso con código cuando la sesión deja de ser válida. */
  onExpired: () => void;
  /** Devuelve al acceso con código por decisión del operador. */
  onLogout: () => void;
}

/** Conecta el estado de la ronda con la consola. Solo se monta tras el acceso. */
function OperatorWorkspace({ onExpired, onLogout }: OperatorWorkspaceProps) {
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
      onToggleManual={operator.setManualMode}
      onSetManualBacks={operator.setManualBacks}
      onSimulateJurorVote={operator.simulateJurorVote}
      onExport={operator.exportCsv}
      onLogout={onLogout}
    />
  );
}
