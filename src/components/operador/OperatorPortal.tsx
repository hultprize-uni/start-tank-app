"use client";

import { useState } from "react";

import {
  loginOperador,
  MENSAJE_SESION_VENCIDA_OPERADOR,
  useOperatorState,
} from "@/lib/api/operator";
import { USA_MOCKS } from "@/lib/api/entorno";

import { AccessGate } from "./AccessGate";
import { OperatorConsole } from "./OperatorConsole";
import gateStyles from "./AccessGate.module.css";

/** Punto de entrada del portal del operador: controla el acceso con código y monta la consola. */
export function OperatorPortal() {
  const [authorized, setAuthorized] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!authorized) {
    return (
      <AccessGate
        aviso={aviso}
        onSubmit={async (code) => {
          const error = await loginOperador(code);
          if (error === null) {
            setAviso(null);
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
        setAviso(MENSAJE_SESION_VENCIDA_OPERADOR);
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
  const operator = useOperatorState({ alExpirarSesion: onExpired });
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
      modoMuestra={USA_MOCKS}
      onRunAction={operator.runAction}
      onUndo={operator.undo}
      onCancelRound={operator.cancelRound}
      onManualSettlement={operator.settleManually}
      onSimulateJurorVote={operator.simulateJurorVote}
      onExport={operator.exportar}
    />
  );
}
