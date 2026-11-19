"use client";

import { useCallback, useState } from "react";

import { USE_MOCKS } from "@/shared/lib/env";

import {
  loginOperator,
  logoutOperator,
  OPERATOR_SESSION_EXPIRED_MESSAGE,
  readOperatorState,
} from "../api/client";
import { MOCK_OPERATOR_CODE } from "../api/mock";
import { useOperatorState } from "../hooks/useOperatorState";
import { useSessionRestore } from "../hooks/useSessionRestore";

import { AccessGate } from "./AccessGate";
import { OperatorConsole } from "./OperatorConsole";
import gateStyles from "./AccessGate.module.css";

/**
 * Comprueba si la cookie de sesión del operador sigue válida. Con datos de muestra no existe
 * cookie, por lo que la sesión inicia en el acceso por código.
 */
async function checkOperatorSession(): Promise<boolean> {
  if (USE_MOCKS) return false;
  const result = await readOperatorState();
  return result.ok;
}

/** Punto de entrada del portal del operador: restaura la sesión, controla el acceso y monta la consola. */
export function OperatorPortal() {
  const session = useSessionRestore(checkOperatorSession);
  const { setStatus } = session;
  const [notice, setNotice] = useState<string | null>(null);

  const handleLogin = useCallback(
    async (code: string) => {
      const error = await loginOperator(code);
      if (error === null) {
        setNotice(null);
        setStatus("authorized");
      }
      return error;
    },
    [setStatus],
  );

  if (session.status === "checking") {
    return (
      <main className={gateStyles.page}>
        <p className={gateStyles.lead} role="status">
          Verificando la sesión...
        </p>
      </main>
    );
  }

  if (session.status === "anonymous") {
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
        setStatus("anonymous");
      }}
      onLogout={() => {
        void logoutOperator().finally(() => {
          setNotice(null);
          setStatus("anonymous");
        });
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

/** Conecta el estado de la ronda con la consola. Solo se monta tras verificar la sesión. */
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
