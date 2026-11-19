import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVENT_CONFIG } from "@/lib/domain/config";
import { investAmount, fetchParticipantState, NO_SESSION } from "./investor.client";
import { useInvestorMockState } from "./investor.mock";
import type {
  InvestorActions,
  InvestorLoadStatus,
  InvestorViewModel,
  InvestmentResult,
  UseInvestorStateResult,
} from "./investor.types";

/*
 * Estado del portal del inversionista. Por defecto consulta la API real; la simulación solo se
 * activa con NEXT_PUBLIC_USE_MOCKS=true, valor que Next.js fija en tiempo de compilación.
 */

/** Mensaje mostrado cuando una actualización del estado no se completa. */
const UPDATE_FAILED_MESSAGE = "No fue posible actualizar la ronda. Reintentando.";

/** View model de la fase de ingreso, usado cuando la API responde sin sesión. */
const LOGIN_VIEW: InvestorViewModel = {
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
  const refreshRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetchParticipantState();
        if (!active) return;
        setVm(response === NO_SESSION ? LOGIN_VIEW : response);
        setStatus("ready");
        setErrorMessage(null);
      } catch {
        if (!active) return;
        setStatus("error");
        setErrorMessage(UPDATE_FAILED_MESSAGE);
      } finally {
        inFlight = false;
      }
    };

    refreshRef.current = refresh;
    void refresh();
    const timer = window.setInterval(() => void refresh(), EVENT_CONFIG.investorPollMs);

    return () => {
      active = false;
      refreshRef.current = null;
      window.clearInterval(timer);
    };
  }, []);

  /** Envía la inversión y actualiza el estado, con el resultado del servidor o con su rechazo. */
  const invest = useCallback(async (amount: number): Promise<InvestmentResult> => {
    const result = await investAmount(amount);
    await refreshRef.current?.();
    return result;
  }, []);

  const actions = useMemo<InvestorActions>(() => ({ invest }), [invest]);

  return { vm, status, errorMessage, actions };
}

/** Estado del portal: API real, o simulación cuando NEXT_PUBLIC_USE_MOCKS vale "true". */
export const useInvestorState: () => UseInvestorStateResult =
  process.env.NEXT_PUBLIC_USE_MOCKS === "true" ? useInvestorMockState : useInvestorRemoteState;
