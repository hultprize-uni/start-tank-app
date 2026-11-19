import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { investAmount, fetchParticipantState, NO_SESSION } from "../api/client";
import { useParticipantMockState } from "../api/mock";
import type {
  ParticipantActions,
  ParticipantLoadStatus,
  ParticipantViewModel,
  InvestmentResult,
  UseParticipantStateResult,
} from "../types";

/*
 * Estado del portal del inversionista. Por defecto consulta la API real; la simulación solo se
 * activa con NEXT_PUBLIC_USE_MOCKS=true, valor que Next.js fija en tiempo de compilación.
 */

/** Mensaje mostrado cuando una actualización del estado no se completa. */
const UPDATE_FAILED_MESSAGE = "No fue posible actualizar la ronda. Reintentando.";

/** View model de la fase de ingreso, usado cuando la API responde sin sesión. */
const LOGIN_VIEW: ParticipantViewModel = {
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
export function useParticipantRemoteState(): UseParticipantStateResult {
  const [vm, setVm] = useState<ParticipantViewModel | null>(null);
  const [status, setStatus] = useState<ParticipantLoadStatus>("loading");
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

  const actions = useMemo<ParticipantActions>(() => ({ invest }), [invest]);

  return { vm, status, errorMessage, actions };
}

/** Estado del portal: API real, o simulación cuando NEXT_PUBLIC_USE_MOCKS vale "true". */
export const useParticipantState: () => UseParticipantStateResult =
  process.env.NEXT_PUBLIC_USE_MOCKS === "true" ? useParticipantMockState : useParticipantRemoteState;
