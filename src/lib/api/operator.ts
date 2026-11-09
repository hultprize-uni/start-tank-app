import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  CancelMode,
  ManualSettlementInput,
  OperatorActionId,
  OperatorActionView,
  OperatorViewModel,
} from "@/lib/api/operator.types";

import { buildSettlementCsv, downloadCsv } from "./operator.export";
import { MENSAJE_SERVIDOR, MENSAJE_SIN_CONEXION, pedirJson } from "./http";
import { USA_MOCKS } from "./entorno";
import {
  useOperatorState as useOperatorStateMock,
  verifyOperatorCode,
} from "./operator.mock";

/** Periodo del sondeo del estado de la consola, en milisegundos. */
export const INTERVALO_SONDEO_OPERADOR_MS = 3_000;

/** Mensaje cuando la sesión del operador ha dejado de ser válida. */
export const MENSAJE_SESION_VENCIDA_OPERADOR =
  "Tu sesión venció. Verifica el código de acceso para continuar.";

const MENSAJE_CODIGO_OPERADOR = "El código no es válido. Verifica el código de acceso del operador.";

const MENSAJE_SIN_RONDAS = "No hay rondas configuradas para el evento.";

const MENSAJE_RONDA_NO_CARGADA = "La ronda aún no se ha cargado. Espera un momento.";

const MENSAJE_ANULAR_NO_DISPONIBLE = "La ronda no se puede anular en su estado actual.";

const MENSAJE_SIN_EQUIVALENTE = "Esta acción no tiene equivalente en la API.";

/** Acciones que la API acepta en POST /api/operador/accion. */
type AccionApi =
  | "ABRIR"
  | "ULTIMA_LLAMADA"
  | "CERRAR"
  | "HABILITAR_VOTO"
  | "REVELAR"
  | "ANULAR_DEVOLVER"
  | "ANULAR_LIQUIDAR_1X";

/** Solicitud del portal: una acción de la ronda o una de las dos variantes de anulación. */
export type SolicitudOperador =
  | OperatorActionId
  | "anular_devolver"
  | "anular_liquidar_1x";

/** Resultado de una operación del portal del operador. */
export type ResultadoOperador<T = null> =
  | { ok: true; valor: T }
  | { ok: false; sesionVencida: boolean; mensaje: string };

const MENSAJES_ACCION: Readonly<Record<string, string>> = {
  ACCION_INVALIDA: "La acción solicitada no es válida.",
  RONDA_NO_DISPONIBLE: "No hay una ronda disponible para esta acción.",
  RONDA_NO_EXISTE: "No hay una ronda disponible para esta acción.",
  TRANSICION_NO_PERMITIDA: "La acción no está permitida en el estado actual de la ronda.",
  OTRA_RONDA_ACTIVA: "Ya hay otra ronda en curso. Cierra o anula esa ronda antes de abrir esta.",
  RONDA_NO_EN_VOTACION: "La ronda no está en votación.",
  VOTOS_PENDIENTES: "Faltan votos por emitir. Revelar se habilita cuando voten todos los jurados.",
  SIN_JURADOS: "No hay jurados registrados.",
  SIN_VOTOS_EMITIDOS: "Ningún jurado ha votado. La ronda no puede revelarse.",
  OPERADOR_NO_EXISTE: "Tu acceso ya no es válido. Verifica el código de acceso del operador.",
};

/** Pasos de API que componen cada solicitud. Cerrar no incluye la habilitación de la votación, que se agrega según la respuesta. */
const PASOS_POR_SOLICITUD: Readonly<Record<SolicitudOperador, readonly AccionApi[]>> = {
  abrir: ["ABRIR"],
  ultima_llamada: ["ULTIMA_LLAMADA"],
  cerrar: ["CERRAR"],
  revelar: ["REVELAR"],
  siguiente: [],
  anular_devolver: ["ANULAR_DEVOLVER"],
  anular_liquidar_1x: ["ANULAR_LIQUIDAR_1X"],
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

interface OpcionesOperador {
  /** Se invoca cuando la sesión del operador deja de ser válida. */
  alExpirarSesion?: () => void;
}

/** Valida el código del operador y establece la cookie de sesión. Devuelve el mensaje de error o null. */
export async function loginOperador(codigo: string): Promise<string | null> {
  if (USA_MOCKS) {
    return verifyOperatorCode(codigo) ? null : MENSAJE_CODIGO_OPERADOR;
  }
  const respuesta = await pedirJson<{ ok: boolean; nombre: string }>("/api/operador/login", {
    metodo: "POST",
    cuerpo: { codigo },
  });
  if (respuesta.ok) return null;
  if (respuesta.sinConexion) return MENSAJE_SIN_CONEXION;
  if (respuesta.codigo === "CODIGO_INVALIDO") return MENSAJE_CODIGO_OPERADOR;
  if (respuesta.codigo === "CODIGO_REQUERIDO") return "Ingresa el código de acceso.";
  return MENSAJE_SERVIDOR;
}

/** Lee el view model completo de la consola para la sesión vigente. */
export async function leerEstadoOperador(): Promise<ResultadoOperador<OperatorViewModel>> {
  const respuesta = await pedirJson<OperatorViewModel>("/api/operador/estado");
  if (respuesta.ok) {
    return { ok: true, valor: respuesta.datos };
  }
  if (respuesta.sinConexion) {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_SIN_CONEXION };
  }
  if (respuesta.estado === 401) {
    return { ok: false, sesionVencida: true, mensaje: MENSAJE_SESION_VENCIDA_OPERADOR };
  }
  if (respuesta.estado === 404) {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_SIN_RONDAS };
  }
  return { ok: false, sesionVencida: false, mensaje: MENSAJE_SERVIDOR };
}

/** Envía una acción individual a la API. */
async function enviarAccion(accion: AccionApi) {
  return pedirJson<{ ok: boolean; estado?: string | null }>("/api/operador/accion", {
    metodo: "POST",
    cuerpo: { accion },
  });
}

/** Traduce un fallo de la API de acciones a un mensaje visible en español. */
function resultadoFallido(respuesta: {
  estado: number;
  codigo: string | null;
  sinConexion: boolean;
}): ResultadoOperador<never> {
  if (respuesta.sinConexion) {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_SIN_CONEXION };
  }
  if (respuesta.estado === 401) {
    return { ok: false, sesionVencida: true, mensaje: MENSAJE_SESION_VENCIDA_OPERADOR };
  }
  const mensaje =
    (respuesta.codigo !== null ? MENSAJES_ACCION[respuesta.codigo] : undefined) ?? MENSAJE_SERVIDOR;
  return { ok: false, sesionVencida: false, mensaje };
}

/**
 * Ejecuta una solicitud del operador sobre la ronda que controla. Antes de llamar a la API verifica
 * el estado de la acción en el view model: si está bloqueada, no envía nada y devuelve el motivo.
 * Cerrar envía CERRAR y, si la ronda queda CERRADA, envía HABILITAR_VOTO para abrir la votación.
 */
export async function ejecutarAccionOperador(
  solicitud: SolicitudOperador,
  vista: OperatorViewModel | null,
): Promise<ResultadoOperador> {
  if (vista === null) {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_RONDA_NO_CARGADA };
  }

  if (solicitud === "anular_devolver" || solicitud === "anular_liquidar_1x") {
    if (!vista.canCancel) {
      return { ok: false, sesionVencida: false, mensaje: MENSAJE_ANULAR_NO_DISPONIBLE };
    }
  } else {
    const accion: OperatorActionView | undefined = vista.actions.find(
      (candidata) => candidata.id === solicitud,
    );
    if (accion === undefined || !accion.enabled) {
      const mensaje =
        accion?.blockedReason ?? "La acción no está disponible en el estado actual de la ronda.";
      return { ok: false, sesionVencida: false, mensaje };
    }
  }

  const pasos = PASOS_POR_SOLICITUD[solicitud];
  if (pasos.length === 0) {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_SIN_EQUIVALENTE };
  }

  for (const paso of pasos) {
    const respuesta = await enviarAccion(paso);
    if (!respuesta.ok) {
      return resultadoFallido(respuesta);
    }
    if (paso === "CERRAR" && respuesta.datos.estado === "CERRADA") {
      const habilitacion = await enviarAccion("HABILITAR_VOTO");
      if (!habilitacion.ok) {
        return resultadoFallido(habilitacion);
      }
    }
  }
  return { ok: true, valor: null };
}

/** Descarga el CSV de saldos y posiciones desde la ruta de exportación. */
export async function descargarExportacion(): Promise<ResultadoOperador> {
  let respuesta: Response;
  try {
    respuesta = await fetch("/api/operador/export", { cache: "no-store" });
  } catch {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_SIN_CONEXION };
  }

  if (respuesta.status === 401) {
    return { ok: false, sesionVencida: true, mensaje: MENSAJE_SESION_VENCIDA_OPERADOR };
  }
  if (respuesta.status === 404) {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_SIN_RONDAS };
  }
  if (!respuesta.ok) {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_SERVIDOR };
  }

  const cabecera = respuesta.headers.get("Content-Disposition") ?? "";
  const coincidencia = cabecera.match(/filename="([^"]+)"/);
  const nombre = coincidencia?.[1] ?? "liquidacion.csv";
  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
  return { ok: true, valor: null };
}

/**
 * Estado de la consola del operador conectado a la API. Sondea el estado cada
 * INTERVALO_SONDEO_OPERADOR_MS y notifica al portal cuando la sesión deja de ser válida.
 */
function useOperatorStateApi(opciones: OpcionesOperador = {}): OperatorPortalState {
  const [viewModel, setViewModel] = useState<OperatorViewModel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const vistaRef = useRef<OperatorViewModel | null>(null);
  const alExpirarRef = useRef(opciones.alExpirarSesion);

  useEffect(() => {
    alExpirarRef.current = opciones.alExpirarSesion;
  });

  const refrescar = useCallback(async () => {
    const resultado = await leerEstadoOperador();
    if (resultado.ok) {
      vistaRef.current = resultado.valor;
      setViewModel(resultado.valor);
      return;
    }
    if (resultado.sesionVencida) {
      alExpirarRef.current?.();
      return;
    }
    setNotice(resultado.mensaje);
  }, []);

  useEffect(() => {
    void refrescar();
    const id = window.setInterval(() => void refrescar(), INTERVALO_SONDEO_OPERADOR_MS);
    return () => window.clearInterval(id);
  }, [refrescar]);

  const ejecutar = useCallback(
    async (solicitud: SolicitudOperador) => {
      const resultado = await ejecutarAccionOperador(solicitud, vistaRef.current);
      if (!resultado.ok && resultado.sesionVencida) {
        alExpirarRef.current?.();
        return;
      }
      setNotice(resultado.ok ? null : resultado.mensaje);
      await refrescar();
    },
    [refrescar],
  );

  const runAction = useCallback((id: OperatorActionId) => void ejecutar(id), [ejecutar]);

  const cancelRound = useCallback(
    (mode: CancelMode) =>
      void ejecutar(mode === "devolver" ? "anular_devolver" : "anular_liquidar_1x"),
    [ejecutar],
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
      const resultado = await descargarExportacion();
      if (!resultado.ok && resultado.sesionVencida) {
        alExpirarRef.current?.();
        return;
      }
      setNotice(resultado.ok ? null : resultado.mensaje);
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
export const useOperatorState: (opciones?: OpcionesOperador) => OperatorPortalState = USA_MOCKS
  ? useOperatorStateMockAdapter
  : useOperatorStateApi;
