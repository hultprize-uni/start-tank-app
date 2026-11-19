import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  CancelMode,
  ManualSettlementInput,
  OperatorActionId,
  OperatorActionView,
  OperatorViewModel,
} from "@/lib/api/operator.types";

import { buildSettlementCsv, downloadCsv } from "./operator.export";
import { SERVER_ERROR_MESSAGE, OFFLINE_MESSAGE, requestJson } from "./http";
import { USE_MOCKS } from "./entorno";
import {
  useOperatorState as useOperatorStateMock,
  verifyOperatorCode,
} from "./operator.mock";

/** Periodo del sondeo del estado de la consola, en milisegundos. */
export const OPERATOR_POLL_INTERVAL_MS = 3_000;

/** Mensaje cuando la sesión del operador ha dejado de ser válida. */
export const OPERATOR_SESSION_EXPIRED_MESSAGE =
  "Tu sesión venció. Verifica el código de acceso para continuar.";

const INVALID_OPERATOR_CODE_MESSAGE = "El código no es válido. Verifica el código de acceso del operador.";

const NO_ROUNDS_MESSAGE = "No hay rondas configuradas para el evento.";

const ROUND_NOT_LOADED_MESSAGE = "La ronda aún no se ha cargado. Espera un momento.";

const CANCEL_UNAVAILABLE_MESSAGE = "La ronda no se puede anular en su estado actual.";

const NO_API_EQUIVALENT_MESSAGE = "Esta acción no tiene equivalente en la API.";

/** Acciones que la API acepta en POST /api/operador/accion. */
type ApiAction =
  | "OPEN"
  | "LAST_CALL"
  | "CLOSE"
  | "ENABLE_VOTING"
  | "REVEAL"
  | "CANCEL_REFUND"
  | "CANCEL_SETTLE_1X";

/** Solicitud del portal: una acción de la ronda o una de las dos variantes de anulación. */
export type OperatorRequest =
  | OperatorActionId
  | "cancel_refund"
  | "cancel_settle_1x";

/** Resultado de una operación del portal del operador. */
export type OperatorResult<T = null> =
  | { ok: true; value: T }
  | { ok: false; sessionExpired: boolean; message: string };

const ACTION_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_ACTION: "La acción solicitada no es válida.",
  ROUND_UNAVAILABLE: "No hay una ronda disponible para esta acción.",
  ROUND_NOT_FOUND: "No hay una ronda disponible para esta acción.",
  TRANSITION_NOT_ALLOWED: "La acción no está permitida en el estado actual de la ronda.",
  ANOTHER_ROUND_ACTIVE: "Ya hay otra ronda en curso. Cierra o anula esa ronda antes de abrir esta.",
  ROUND_NOT_VOTING: "La ronda no está en votación.",
  PENDING_VOTES: "Faltan votos por emitir. Revelar se habilita cuando voten todos los jurados.",
  NO_JURORS: "No hay jurados registrados.",
  NO_VOTES_CAST: "Ningún jurado ha votado. La ronda no puede revelarse.",
  OPERATOR_NOT_FOUND: "Tu acceso ya no es válido. Verifica el código de acceso del operador.",
};

/** Pasos de API que componen cada solicitud. Cerrar no incluye la habilitación de la votación, que se agrega según la respuesta. */
const STEPS_BY_REQUEST: Readonly<Record<OperatorRequest, readonly ApiAction[]>> = {
  open: ["OPEN"],
  last_call: ["LAST_CALL"],
  close: ["CLOSE"],
  reveal: ["REVEAL"],
  next: [],
  cancel_refund: ["CANCEL_REFUND"],
  cancel_settle_1x: ["CANCEL_SETTLE_1X"],
};

/** Estado del portal del operador que consumen los componentes. */
export interface OperatorPortalState {
  /** Null mientras no llega la primera respuesta del servidor. */
  viewModel: OperatorViewModel | null;
  /** Aviso visible de la última operación fallida o pendiente. Es null cuando no hay aviso. */
  notice: string | null;
  runAction: (id: OperatorActionId) => void;
  undo: () => void;
  cancelRound: (mode: CancelMode) => void;
  settleManually: (input: ManualSettlementInput) => void;
  simulateJurorVote: (jurorId: string) => void;
  exportar: () => void;
}

interface OperatorOptions {
  /** Se invoca cuando la sesión del operador deja de ser válida. */
  onSessionExpired?: () => void;
}

/** Valida el código del operador y establece la cookie de sesión. Devuelve el mensaje de error o null. */
export async function loginOperator(code: string): Promise<string | null> {
  if (USE_MOCKS) {
    return verifyOperatorCode(code) ? null : INVALID_OPERATOR_CODE_MESSAGE;
  }
  const response = await requestJson<{ ok: boolean; name: string }>("/api/operador/login", {
    method: "POST",
    body: { code },
  });
  if (response.ok) return null;
  if (response.offline) return OFFLINE_MESSAGE;
  if (response.code === "INVALID_CODE") return INVALID_OPERATOR_CODE_MESSAGE;
  if (response.code === "CODE_REQUIRED") return "Ingresa el código de acceso.";
  return SERVER_ERROR_MESSAGE;
}

/** Lee el view model completo de la consola para la sesión vigente. */
export async function readOperatorState(): Promise<OperatorResult<OperatorViewModel>> {
  const response = await requestJson<OperatorViewModel>("/api/operador/estado");
  if (response.ok) {
    return { ok: true, value: response.data };
  }
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: OPERATOR_SESSION_EXPIRED_MESSAGE };
  }
  if (response.status === 404) {
    return { ok: false, sessionExpired: false, message: NO_ROUNDS_MESSAGE };
  }
  return { ok: false, sessionExpired: false, message: SERVER_ERROR_MESSAGE };
}

/** Envía una acción individual a la API. */
async function sendAction(action: ApiAction) {
  return requestJson<{ ok: boolean; state?: string | null }>("/api/operador/accion", {
    method: "POST",
    body: { accion: action },
  });
}

/** Traduce un fallo de la API de acciones a un mensaje visible en español. */
function failedResult(response: {
  status: number;
  code: string | null;
  offline: boolean;
}): OperatorResult<never> {
  if (response.offline) {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }
  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: OPERATOR_SESSION_EXPIRED_MESSAGE };
  }
  const message =
    (response.code !== null ? ACTION_MESSAGES[response.code] : undefined) ?? SERVER_ERROR_MESSAGE;
  return { ok: false, sessionExpired: false, message: message };
}

/**
 * Ejecuta una solicitud del operador sobre la ronda que controla. Antes de llamar a la API verifica
 * el estado de la acción en el view model: si está bloqueada, no envía nada y devuelve el motivo.
 * Cerrar envía CERRAR y, si la ronda queda CERRADA, envía HABILITAR_VOTO para abrir la votación.
 */
export async function executeOperatorAction(
  request: OperatorRequest,
  view: OperatorViewModel | null,
): Promise<OperatorResult> {
  if (view === null) {
    return { ok: false, sessionExpired: false, message: ROUND_NOT_LOADED_MESSAGE };
  }

  if (request === "cancel_refund" || request === "cancel_settle_1x") {
    if (!view.canCancel) {
      return { ok: false, sessionExpired: false, message: CANCEL_UNAVAILABLE_MESSAGE };
    }
  } else {
    const action: OperatorActionView | undefined = view.actions.find(
      (candidata) => candidata.id === request,
    );
    if (action === undefined || !action.enabled) {
      const message =
        action?.blockedReason ?? "La acción no está disponible en el estado actual de la ronda.";
      return { ok: false, sessionExpired: false, message: message };
    }
  }

  const steps = STEPS_BY_REQUEST[request];
  if (steps.length === 0) {
    return { ok: false, sessionExpired: false, message: NO_API_EQUIVALENT_MESSAGE };
  }

  for (const step of steps) {
    const response = await sendAction(step);
    if (!response.ok) {
      return failedResult(response);
    }
    if (step === "CLOSE" && response.data.state === "CLOSED") {
      const enablement = await sendAction("ENABLE_VOTING");
      if (!enablement.ok) {
        return failedResult(enablement);
      }
    }
  }
  return { ok: true, value: null };
}

/** Descarga el CSV de saldos y posiciones desde la ruta de exportación. */
export async function downloadExport(): Promise<OperatorResult> {
  let response: Response;
  try {
    response = await fetch("/api/operador/export", { cache: "no-store" });
  } catch {
    return { ok: false, sessionExpired: false, message: OFFLINE_MESSAGE };
  }

  if (response.status === 401) {
    return { ok: false, sessionExpired: true, message: OPERATOR_SESSION_EXPIRED_MESSAGE };
  }
  if (response.status === 404) {
    return { ok: false, sessionExpired: false, message: NO_ROUNDS_MESSAGE };
  }
  if (!response.ok) {
    return { ok: false, sessionExpired: false, message: SERVER_ERROR_MESSAGE };
  }

  const contentDisposition = response.headers.get("Content-Disposition") ?? "";
  const matched = contentDisposition.match(/filename="([^"]+)"/);
  const name = matched?.[1] ?? "liquidacion.csv";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { ok: true, value: null };
}

/**
 * Estado de la consola del operador conectado a la API. Sondea el estado cada
 * INTERVALO_SONDEO_OPERADOR_MS y notifica al portal cuando la sesión deja de ser válida.
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
    setNotice("Pendiente de API: deshacer la última acción no está disponible.");
  }, []);

  const settleManually = useCallback(() => {
    setNotice("Pendiente de API: el modo manual no está disponible.");
  }, []);

  const simulateJurorVote = useCallback(() => {
    // Sin equivalente en la API: la simulación de votos pertenece a los datos de muestra.
  }, []);

  const exportar = useCallback(() => {
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
      settleManually,
      simulateJurorVote,
      exportar,
    }),
    [viewModel, notice, runAction, undo, cancelRound, settleManually, simulateJurorVote, exportar],
  );
}

/** Adapta el estado de muestra al contrato del portal, con exportación local en el CSV de muestra. */
function useOperatorStateMockAdapter(): OperatorPortalState {
  const api = useOperatorStateMock();
  const { viewModel } = api;

  const exportar = useCallback(() => {
    if (viewModel === null) return;
    downloadCsv(
      `start-tank-ronda-${viewModel.round.number}-saldos-posiciones.csv`,
      buildSettlementCsv(viewModel),
    );
  }, [viewModel]);

  return useMemo(() => ({ ...api, notice: null, exportar }), [api, exportar]);
}

/**
 * Estado del portal del operador. Usa los datos de muestra solo con NEXT_PUBLIC_USE_MOCKS=true; en
 * otro caso consume la API. La selección ocurre en tiempo de compilación.
 */
export const useOperatorState: (options?: OperatorOptions) => OperatorPortalState = USE_MOCKS
  ? useOperatorStateMockAdapter
  : useOperatorStateApi;
