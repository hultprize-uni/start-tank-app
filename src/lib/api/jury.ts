import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Decision } from "@/lib/domain/types";
import type {
  JuryAccessView,
  JuryActions,
  JuryViewModel,
  JuryVoteView,
} from "@/lib/api/jury.types";

import { MENSAJE_SERVIDOR, MENSAJE_SIN_CONEXION, pedirJson } from "./http";
import { USA_MOCKS } from "./entorno";
import { useJuryState as useJuryStateMock } from "./jury.mock";

/** Periodo del sondeo del estado del jurado, en milisegundos. */
export const INTERVALO_SONDEO_JURADO_MS = 3_000;

/** Mensaje cuando la sesión del jurado ha dejado de ser válida. */
export const MENSAJE_SESION_VENCIDA_JURADO = "Tu sesión venció. Ingresa tu código de nuevo.";

const MENSAJES_LOGIN: Readonly<Record<string, string>> = {
  CODIGO_REQUERIDO: "Ingresa tu código de acceso.",
  CODIGO_INVALIDO: "El código no es válido. Revísalo e inténtalo de nuevo.",
};

const MENSAJES_VOTO: Readonly<Record<string, string>> = {
  DECISION_INVALIDA: "Elige una decisión antes de confirmar.",
  RONDA_NO_EXISTE: "No hay una ronda activa para votar.",
  RONDA_NO_EN_VOTACION: "La votación de esta ronda ya no está abierta.",
  VOTO_DUPLICADO: "Ya registraste tu voto en esta ronda.",
  JURADO_NO_EXISTE: "Tu acceso ya no es válido. Ingresa tu código de nuevo.",
};

const ACCESO_INICIAL: JuryAccessView = { status: "inactivo", errorMessage: null };

const VOTO_INICIAL: JuryVoteView = {
  draft: null,
  confirming: false,
  submitting: false,
  errorMessage: null,
};

const ESTADO_INICIAL: JuryViewModel = {
  screen: "acceso",
  access: ACCESO_INICIAL,
  jurorLabel: null,
  round: null,
  criteria: [],
  vote: VOTO_INICIAL,
  votes: { emitted: 0, total: 0 },
};

/** Resultado de una operación del portal del jurado. Cuando sesionVencida es true, la sesión debe reiniciarse. */
export type ResultadoJurado<T = null> =
  | { ok: true; valor: T }
  | { ok: false; sesionVencida: boolean; mensaje: string };

/** Valida el código de acceso y establece la cookie de sesión del jurado. */
export async function loginJurado(codigo: string): Promise<ResultadoJurado> {
  const respuesta = await pedirJson<{ ok: boolean; nombre: string }>("/api/jurado/login", {
    metodo: "POST",
    cuerpo: { codigo },
  });
  if (respuesta.ok) {
    return { ok: true, valor: null };
  }
  if (respuesta.sinConexion) {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_SIN_CONEXION };
  }
  const mensaje =
    (respuesta.codigo !== null ? MENSAJES_LOGIN[respuesta.codigo] : undefined) ?? MENSAJE_SERVIDOR;
  return { ok: false, sesionVencida: false, mensaje };
}

/** Lee el view model del portal del jurado para la sesión vigente. */
export async function leerEstadoJurado(): Promise<ResultadoJurado<JuryViewModel>> {
  const respuesta = await pedirJson<JuryViewModel>("/api/jurado/estado");
  if (respuesta.ok) {
    return { ok: true, valor: respuesta.datos };
  }
  if (respuesta.sinConexion) {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_SIN_CONEXION };
  }
  if (respuesta.estado === 401) {
    return { ok: false, sesionVencida: true, mensaje: MENSAJE_SESION_VENCIDA_JURADO };
  }
  return { ok: false, sesionVencida: false, mensaje: MENSAJE_SERVIDOR };
}

/** Registra el voto definitivo del jurado en la ronda activa. */
export async function votarJurado(decision: Decision): Promise<ResultadoJurado> {
  const respuesta = await pedirJson<{ ok: boolean }>("/api/jurado/voto", {
    metodo: "POST",
    cuerpo: { decision },
  });
  if (respuesta.ok) {
    return { ok: true, valor: null };
  }
  if (respuesta.sinConexion) {
    return { ok: false, sesionVencida: false, mensaje: MENSAJE_SIN_CONEXION };
  }
  if (respuesta.estado === 401) {
    return { ok: false, sesionVencida: true, mensaje: MENSAJE_SESION_VENCIDA_JURADO };
  }
  const mensaje =
    (respuesta.codigo !== null ? MENSAJES_VOTO[respuesta.codigo] : undefined) ?? MENSAJE_SERVIDOR;
  return { ok: false, sesionVencida: false, mensaje };
}

/**
 * Combina el estado recibido del servidor con los datos locales del voto. El borrador y la
 * confirmación solo se conservan mientras la ronda siga en votación.
 */
function fusionarEstado(prev: JuryViewModel, vista: JuryViewModel): JuryViewModel {
  const mismaVotacion = prev.screen === "votacion" && vista.screen === "votacion";
  return {
    ...vista,
    access: ACCESO_INICIAL,
    vote: mismaVotacion ? prev.vote : VOTO_INICIAL,
  };
}

/**
 * Estado del portal del jurado conectado a la API. Tras el acceso con código, sondea el estado
 * cada INTERVALO_SONDEO_JURADO_MS y devuelve al acceso cuando la sesión deja de ser válida.
 */
function useJuryStateApi(): { state: JuryViewModel; actions: JuryActions } {
  const [state, setState] = useState<JuryViewModel>(ESTADO_INICIAL);
  const [sesionActiva, setSesionActiva] = useState(false);
  const estadoRef = useRef(state);

  useEffect(() => {
    estadoRef.current = state;
  }, [state]);

  const cerrarSesion = useCallback((mensaje: string) => {
    setSesionActiva(false);
    setState({ ...ESTADO_INICIAL, access: { status: "inactivo", errorMessage: mensaje } });
  }, []);

  const refrescar = useCallback(async () => {
    const resultado = await leerEstadoJurado();
    if (resultado.ok) {
      setState((prev) => fusionarEstado(prev, resultado.valor));
    } else if (resultado.sesionVencida) {
      cerrarSesion(resultado.mensaje);
    }
  }, [cerrarSesion]);

  useEffect(() => {
    if (!sesionActiva) return;
    void refrescar();
    const id = window.setInterval(() => void refrescar(), INTERVALO_SONDEO_JURADO_MS);
    return () => window.clearInterval(id);
  }, [sesionActiva, refrescar]);

  const submitCode = useCallback((codigo: string) => {
    setState((prev) => ({ ...prev, access: { status: "validando", errorMessage: null } }));
    void (async () => {
      const resultado = await loginJurado(codigo);
      if (!resultado.ok) {
        setState((prev) => ({
          ...prev,
          access: { status: "error", errorMessage: resultado.mensaje },
        }));
        return;
      }
      setState((prev) => ({ ...prev, access: ACCESO_INICIAL }));
      setSesionActiva(true);
    })();
  }, []);

  const selectDecision = useCallback((decision: Decision) => {
    setState((prev) => ({
      ...prev,
      vote: { ...prev.vote, draft: decision, confirming: false, errorMessage: null },
    }));
  }, []);

  const requestConfirm = useCallback(() => {
    setState((prev) => {
      if (prev.vote.draft === null) return prev;
      return { ...prev, vote: { ...prev.vote, confirming: true } };
    });
  }, []);

  const cancelConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, vote: { ...prev.vote, confirming: false } }));
  }, []);

  const confirmVote = useCallback(() => {
    const decision = estadoRef.current.vote.draft;
    if (decision === null) return;

    setState((prev) => ({
      ...prev,
      vote: { ...prev.vote, submitting: true, errorMessage: null },
    }));
    void (async () => {
      const resultado = await votarJurado(decision);
      if (resultado.ok) {
        setState((prev) => ({ ...prev, screen: "voto_registrado", vote: VOTO_INICIAL }));
        await refrescar();
        return;
      }
      if (resultado.sesionVencida) {
        cerrarSesion(resultado.mensaje);
        return;
      }
      setState((prev) => ({
        ...prev,
        vote: {
          draft: prev.vote.draft,
          confirming: false,
          submitting: false,
          errorMessage: resultado.mensaje,
        },
      }));
      await refrescar();
    })();
  }, [refrescar, cerrarSesion]);

  return useMemo(
    () => ({
      state,
      actions: {
        submitCode,
        selectDecision,
        requestConfirm,
        cancelConfirm,
        confirmVote,
      },
    }),
    [state, submitCode, selectDecision, requestConfirm, cancelConfirm, confirmVote],
  );
}

/**
 * Estado del portal del jurado. Usa los datos de muestra solo con NEXT_PUBLIC_USE_MOCKS=true; en
 * otro caso consume la API. La selección ocurre en tiempo de compilación.
 */
export const useJuryState: () => { state: JuryViewModel; actions: JuryActions } = USA_MOCKS
  ? useJuryStateMock
  : useJuryStateApi;
