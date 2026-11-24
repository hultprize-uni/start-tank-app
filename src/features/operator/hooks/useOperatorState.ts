"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { usePolling } from "@/shared/lib/use-polling";

import {
  downloadExport,
  readOperatorState,
  runOperatorCommand,
  type OperatorCommand,
  type OperatorResult,
} from "../api/client";
import { OPERATOR_POLL_MS } from "../thresholds";
import type { OperatorViewModel } from "../types";

/** Estado de la consola que consumen los componentes. */
export interface OperatorPortalState {
  /** Null mientras no llega la primera respuesta del servidor. */
  viewModel: OperatorViewModel | null;
  /** Aviso de la última operación fallida. Null cuando no hay aviso. */
  notice: string | null;
  clearNotice: () => void;
  /** Hora local (ms) de la última respuesta correcta del servidor. */
  lastOkAt: number;
  /** Ejecuta un comando de ronda y refresca. Devuelve el resultado para los diálogos. */
  run: (command: OperatorCommand) => Promise<OperatorResult<{ multiplier: number | null }>>;
  /** Indica si hay un comando en curso, para no enviar dos veces. */
  busy: boolean;
  refresh: () => Promise<void>;
  exportCsv: () => void;
}

interface OperatorOptions {
  /** Se invoca cuando la sesión del operador deja de ser válida. */
  onSessionExpired?: () => void;
}

/**
 * Estado de la consola del operador. Consulta el estado cada 3 segundos (sin solaparse y en pausa
 * con la pestaña oculta) y avisa al portal cuando la sesión vence.
 */
export function useOperatorState(options: OperatorOptions = {}): OperatorPortalState {
  const [viewModel, setViewModel] = useState<OperatorViewModel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastOkAt, setLastOkAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const onExpiredRef = useRef(options.onSessionExpired);
  onExpiredRef.current = options.onSessionExpired;

  const refresh = useCallback(async () => {
    const result = await readOperatorState();
    if (result.ok) {
      setViewModel(result.value);
      setLastOkAt(Date.now());
      return;
    }
    if (result.sessionExpired) {
      onExpiredRef.current?.();
      return;
    }
    // Sin datos nuevos se conserva el último view model; la alerta de conexión lo indica.
    if (viewModel === null) setNotice(result.message);
  }, [viewModel]);

  usePolling(refresh, OPERATOR_POLL_MS);

  const run = useCallback(
    async (command: OperatorCommand) => {
      setBusy(true);
      try {
        const result = await runOperatorCommand(command);
        if (!result.ok && result.sessionExpired) {
          onExpiredRef.current?.();
          return result;
        }
        setNotice(result.ok ? null : result.message);
        await refresh();
        return result;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const exportCsv = useCallback(() => {
    void (async () => {
      const result = await downloadExport();
      if (!result.ok && result.sessionExpired) {
        onExpiredRef.current?.();
        return;
      }
      setNotice(result.ok ? null : result.message);
    })();
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  return useMemo(
    () => ({ viewModel, notice, clearNotice, lastOkAt, run, busy, refresh, exportCsv }),
    [viewModel, notice, clearNotice, lastOkAt, run, busy, refresh, exportCsv],
  );
}
