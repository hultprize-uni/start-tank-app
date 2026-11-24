"use client";

import { useCallback, useEffect, useState } from "react";

import { AnimatedBackground, Toast } from "@/shared/ui";
import { USE_MOCKS } from "@/shared/lib/env";

import {
  loginOperator,
  logoutOperator,
  OPERATOR_SESSION_EXPIRED_MESSAGE,
  readOperatorState,
  setManualMode,
  submitManualSettlement,
} from "../api/client";
import { MOCK_OPERATOR_CODE, MOCK_REHEARSAL_CODE, MOCK_SUPPORT_CODE } from "../api/mock";
import { useAlertSound } from "../hooks/useAlertSound";
import { useHealth } from "../hooks/useHealth";
import { useOperatorState } from "../hooks/useOperatorState";
import { useSessionRestore } from "../hooks/useSessionRestore";
import type { AlertAction, CancelMode, OperatorActionId, TimerCommand } from "../types";

import { AccessGate } from "./AccessGate";
import { ActionLogPanel } from "./ActionLogPanel";
import { AlertBanner } from "./AlertBanner";
import { AttendeeSearch } from "./AttendeeSearch";
import { ConfigPanel } from "./ConfigPanel";
import { HealthBar } from "./HealthBar";
import { HealthSection } from "./HealthSection";
import { ManualModePanel } from "./ManualModePanel";
import { OperatorConsole, type ConsoleDialog } from "./OperatorConsole";
import {
  OPERATOR_SECTIONS,
  OperatorSidebar,
  type OperatorSection,
} from "./OperatorSidebar";
import { PreflightChecklist } from "./PreflightChecklist";
import gateStyles from "./AccessGate.module.css";
import styles from "./Admin.module.css";

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

  const handleExpired = useCallback(() => {
    setNotice(OPERATOR_SESSION_EXPIRED_MESSAGE);
    setStatus("anonymous");
  }, [setStatus]);

  const handleLogout = useCallback(() => {
    void logoutOperator().finally(() => {
      setNotice(null);
      setStatus("anonymous");
    });
  }, [setStatus]);

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
        demoCode={
          USE_MOCKS
            ? `${MOCK_OPERATOR_CODE} (conductor), ${MOCK_SUPPORT_CODE} (soporte), ${MOCK_REHEARSAL_CODE} (antes del evento)`
            : undefined
        }
      />
    );
  }

  return <OperatorWorkspace onExpired={handleExpired} onLogout={handleLogout} />;
}

/** Sección inicial según el ancla de la URL, para poder recargar sin perder la sección. */
function sectionFromHash(): OperatorSection {
  if (typeof window === "undefined") return "consola";
  const hash = window.location.hash.replace("#", "");
  return OPERATOR_SECTIONS.some((item) => item.id === hash) ? (hash as OperatorSection) : "consola";
}

interface OperatorWorkspaceProps {
  /** Devuelve al acceso con código cuando la sesión deja de ser válida. */
  onExpired: () => void;
  /** Devuelve al acceso con código por decisión del operador. */
  onLogout: () => void;
}

/** Consola con sus secciones. Solo se monta tras verificar la sesión. */
function OperatorWorkspace({ onExpired, onLogout }: OperatorWorkspaceProps) {
  const operator = useOperatorState({ onSessionExpired: onExpired });
  const { viewModel, notice, run } = operator;
  const { health, alerts } = useHealth({ lastOkAt: operator.lastOkAt, onSessionExpired: onExpired });
  const sound = useAlertSound(alerts);
  const [section, setSection] = useState<OperatorSection>("consola");
  const [dialog, setDialog] = useState<ConsoleDialog>(null);

  useEffect(() => {
    setSection(sectionFromHash());
  }, []);

  const goTo = useCallback((next: OperatorSection) => {
    setSection(next);
    try {
      window.history.replaceState(null, "", `#${next}`);
    } catch {
      // Sin historial disponible: la sección se conserva en memoria.
    }
  }, []);

  const onRun = useCallback((id: OperatorActionId) => void run({ type: "step", id }), [run]);
  const onTimer = useCallback(
    (command: TimerCommand) => void run({ type: "timer", command }),
    [run],
  );
  const onCancel = useCallback(
    async (mode: CancelMode, reason: string) => {
      const result = await run({ type: "cancel", mode, reason });
      return result.ok ? null : result.message;
    },
    [run],
  );
  const onRescue = useCallback(
    async (reason: string) => {
      const result = await run({ type: "rescue", reason });
      return result.ok ? null : result.message;
    },
    [run],
  );
  const onManualSettle = useCallback(
    async (score: number, reason: string) => {
      const result = await submitManualSettlement(score, reason);
      if (!result.ok) {
        if (result.sessionExpired) onExpired();
        return { error: result.message };
      }
      await operator.refresh();
      return { multiplier: result.value.multiplier };
    },
    [onExpired, operator],
  );
  const onToggleManual = useCallback(
    async (enabled: boolean, reason: string | null) => {
      const result = await setManualMode(enabled, reason);
      if (!result.ok) {
        if (result.sessionExpired) onExpired();
        return result.message;
      }
      await operator.refresh();
      return null;
    },
    [onExpired, operator],
  );

  const onAlertAction = useCallback(
    (action: AlertAction) => {
      if (action === "rescue") {
        goTo("consola");
        setDialog("rescue");
      } else if (action === "manual_mode") {
        goTo("salud");
      } else if (action === "attendees") {
        goTo("asistentes");
      } else {
        void operator.refresh();
      }
    },
    [goTo, operator],
  );

  if (viewModel === null) {
    return (
      <main className={gateStyles.page}>
        <p className={gateStyles.lead} role="status">
          {notice ?? "Cargando la ronda..."}
        </p>
      </main>
    );
  }

  const canWrite = viewModel.operator.role === "CONDUCTOR";

  return (
    <div className={styles.page}>
      <AnimatedBackground />
      <div className={styles.shell}>
        <OperatorSidebar
          role={viewModel.operator.role}
          operatorName={viewModel.operator.name}
          section={section}
          onSection={goTo}
          rounds={viewModel.rounds}
          currentRound={viewModel.round.number}
          onLogout={onLogout}
        />

        <main className={styles.main}>
          {health !== null ? <HealthBar signals={health.signals} /> : null}
          <AlertBanner
            alerts={alerts}
            canAct={canWrite}
            canRescue={viewModel.canRescue}
            muted={sound.muted}
            onToggleMuted={sound.toggleMuted}
            onAction={onAlertAction}
          />

          {notice !== null ? (
            <Toast tone="warning" role="alert">
              {notice}
            </Toast>
          ) : null}

          {section === "consola" ? (
            <OperatorConsole
              viewModel={viewModel}
              busy={operator.busy}
              dialog={dialog}
              onDialog={setDialog}
              onRun={onRun}
              onTimer={onTimer}
              onCancel={onCancel}
              onRescue={onRescue}
              onManualSettle={onManualSettle}
              onExport={operator.exportCsv}
            />
          ) : null}

          {section === "salud" ? (
            <HealthSection health={health}>
              <ManualModePanel
                enabled={viewModel.event.manualMode}
                lastSettledRound={viewModel.event.lastSettledRound}
                canWrite={canWrite}
                onToggle={onToggleManual}
              />
            </HealthSection>
          ) : null}

          {section === "asistentes" ? (
            <AttendeeSearch canAdjust={canWrite} onSessionExpired={onExpired} />
          ) : null}

          {section === "log" ? <ActionLogPanel entries={viewModel.log} /> : null}

          {section === "configuracion" ? (
            <ConfigPanel canWrite={canWrite} onSessionExpired={onExpired} />
          ) : null}

          {section === "antes" ? (
            <PreflightChecklist
              canWrite={canWrite}
              onSessionExpired={onExpired}
              onChanged={() => void operator.refresh()}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
