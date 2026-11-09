import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVENT_CONFIG } from "@/lib/domain/config";
import { invertirMonto, obtenerEstadoInversionista, SIN_SESION } from "./investor.client";
import { useInvestorMockState } from "./investor.mock";
import type {
  InvestorActions,
  InvestorLoadStatus,
  InvestorViewModel,
  ResultadoInversion,
  UseInvestorStateResult,
} from "./investor.types";

/*
 * Estado del portal del inversionista. Por defecto consulta la API real; la simulación solo se
 * activa con NEXT_PUBLIC_USE_MOCKS=true, valor que Next.js fija en tiempo de compilación.
 */

/** Mensaje mostrado cuando una actualización del estado no se completa. */
const MENSAJE_ACTUALIZACION = "No fue posible actualizar la ronda. Reintentando.";

/** View model de la fase de ingreso, usado cuando la API responde sin sesión. */
const VISTA_INGRESO: InvestorViewModel = {
  phase: "login",
  round: null,
  startup: null,
  wallet: null,
  market: null,
  countdownSeconds: null,
  verdict: null,
  standing: null,
};

/**
 * Hook del estado real. Consulta /api/inversionista/estado al montar y cada
 * EVENT_CONFIG.investorPollMs. Al recargar la página, el estado se reanuda desde el servidor.
 */
export function useInvestorRemoteState(): UseInvestorStateResult {
  const [vm, setVm] = useState<InvestorViewModel | null>(null);
  const [status, setStatus] = useState<InvestorLoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const actualizarRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let activo = true;
    let enVuelo = false;

    const actualizar = async () => {
      if (enVuelo) return;
      enVuelo = true;
      try {
        const respuesta = await obtenerEstadoInversionista();
        if (!activo) return;
        setVm(respuesta === SIN_SESION ? VISTA_INGRESO : respuesta);
        setStatus("ready");
        setErrorMessage(null);
      } catch {
        if (!activo) return;
        setStatus("error");
        setErrorMessage(MENSAJE_ACTUALIZACION);
      } finally {
        enVuelo = false;
      }
    };

    actualizarRef.current = actualizar;
    void actualizar();
    const temporizador = window.setInterval(() => void actualizar(), EVENT_CONFIG.investorPollMs);

    return () => {
      activo = false;
      actualizarRef.current = null;
      window.clearInterval(temporizador);
    };
  }, []);

  /** Envía la inversión y actualiza el estado, con el resultado del servidor o con su rechazo. */
  const invest = useCallback(async (amount: number): Promise<ResultadoInversion> => {
    const resultado = await invertirMonto(amount);
    await actualizarRef.current?.();
    return resultado;
  }, []);

  const actions = useMemo<InvestorActions>(() => ({ invest }), [invest]);

  return { vm, status, errorMessage, actions };
}

/** Estado del portal: API real, o simulación cuando NEXT_PUBLIC_USE_MOCKS vale "true". */
export const useInvestorState: () => UseInvestorStateResult =
  process.env.NEXT_PUBLIC_USE_MOCKS === "true" ? useInvestorMockState : useInvestorRemoteState;
