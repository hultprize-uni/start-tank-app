import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { USE_MOCKS } from "@/shared/lib/env";
import {
  downloadExport,
  executeOperatorAction,
  readOperatorState,
  type OperatorRequest,
} from "../api/client";
import { buildSettlementCsv, downloadCsv } from "../api/export";
import { useOperatorState as useOperatorStateMock } from "../api/mock";
import type { CancelMode, OperatorActionId, OperatorViewModel } from "../types";

/** Mensaje mostrado mientras la API no ofrece el modo manual. */
export const MANUAL_MODE_PENDING_MESSAGE =
  "Pendiente de API: el modo manual no está disponible.";

/** Mensaje mostrado mientras la API no ofrece deshacer la última acción. */
export const UNDO_PENDING_MESSAGE =
  "Pendiente de API: deshacer la última acción no está disponible.";

/** Periodo del sondeo del estado de la consola, en milisegundos. */
export const OPERATOR_POLL_INTERVAL_MS = 3_000;

/** Estado del portal del operador que consumen los componentes. */
export interface OperatorPortalState {
  /** Null mientras no llega la primera respuesta del servidor. */
  viewModel: OperatorViewModel | null;
  /** Aviso visible de la última operación fallida o pendiente. Es null cuando no hay aviso. */
  notice: string | null;
  runAction: (id: OperatorActionId) => void;
  undo: () => void;
  cancelRound: (mode: CancelMode) => void;
  setManualMode: (enabled: boolean) => void;
  setManualBacks: (backs: number) => void;
  simulateJurorVote: (jurorId: string) => void;
  exportCsv: () => void;
}

interface OperatorOptions {
  /** Se invoca cuando la sesión del operador deja de ser válida. */
  onSessionExpired?: () => void;
}


/**
 * Estado de la consola del operador conectado a la API. Sondea el estado cada
 * OPERATOR_POLL_INTERVAL_MS y notifica al portal cuando la sesión deja de ser válida.
 */
function useOperatorStateApi(options: OperatorOptions = {}): OperatorPortalState {
  const [viewModel, setViewModel] = useState<OperatorViewModel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const viewRef = useRef<OperatorViewModel | null>(null);
  const onExpiredRef = useRef(options.onSessionExpired);

  useEffect(() => {
    onExpiredRef.current = options.onSessionExpired;
  });

  const refresh = useCallback(async () => {
    const result = await readOperatorState();
    if (result.ok) {
      viewRef.current = result.value;
      setViewModel(result.value);
      return;
    }
    if (result.sessionExpired) {
      onExpiredRef.current?.();
      return;
    }
    setNotice(result.message);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), OPERATOR_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const execute = useCallback(
    async (request: OperatorRequest) => {
      const result = await executeOperatorAction(request, viewRef.current);
      if (!result.ok && result.sessionExpired) {
        onExpiredRef.current?.();
        return;
      }
      setNotice(result.ok ? null : result.message);
      await refresh();
    },
    [refresh],
  );

  const runAction = useCallback((id: OperatorActionId) => void execute(id), [execute]);

  const cancelRound = useCallback(
    (mode: CancelMode) =>
      void execute(mode === "refund" ? "cancel_refund" : "cancel_settle_1x"),
    [execute],
  );

  const undo = useCallback(() => {
    setNotice(UNDO_PENDING_MESSAGE);
  }, []);

  const setManualMode = useCallback(() => {
    setNotice(MANUAL_MODE_PENDING_MESSAGE);
  }, []);

  const setManualBacks = useCallback(() => {
    setNotice(MANUAL_MODE_PENDING_MESSAGE);
  }, []);

  const simulateJurorVote = useCallback(() => {
    // Sin equivalente en la API: la simulación de votos pertenece a los datos de muestra.
  }, []);

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

  return useMemo(
    () => ({
      viewModel,
      notice,
      runAction,
      undo,
      cancelRound,
      setManualMode,
      setManualBacks,
      simulateJurorVote,
      exportCsv,
    }),
    [
      viewModel,
      notice,
      runAction,
      undo,
      cancelRound,
      setManualMode,
      setManualBacks,
      simulateJurorVote,
      exportCsv,
    ],
  );
}

/** Adapta el estado de muestra al contrato del portal, con exportación local en el CSV de muestra. */
function useOperatorStateMockAdapter(): OperatorPortalState {
  const api = useOperatorStateMock();
  const { viewModel } = api;

  const exportCsv = useCallback(() => {
    if (viewModel === null) return;
    downloadCsv(
      `start-tank-ronda-${viewModel.round.number}-saldos-posiciones.csv`,
      buildSettlementCsv(viewModel),
    );
  }, [viewModel]);

  return useMemo(() => ({ ...api, notice: null, exportCsv }), [api, exportCsv]);
}

/**
 * Estado del portal del operador. Usa los datos de muestra solo con NEXT_PUBLIC_USE_MOCKS=true; en
 * otro caso consume la API. La selección ocurre en tiempo de compilación.
 */
export const useOperatorState: (options?: OperatorOptions) => OperatorPortalState = USE_MOCKS
  ? useOperatorStateMockAdapter
  : useOperatorStateApi;
