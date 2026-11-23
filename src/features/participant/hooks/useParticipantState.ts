"use client";

import { useCallback, useMemo, useState } from "react";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { usePolling } from "@/shared/lib/use-polling";
import { investAmount, fetchParticipantState, NO_SESSION } from "../api/client";
import { useParticipantMockState } from "../api/mock";
import { UPDATE_FAILED_MESSAGE } from "../messages";
import type {
  ParticipantActions,
  ParticipantLoadStatus,
  ParticipantViewModel,
  InvestmentResult,
  UseParticipantStateResult,
} from "../types";
import { useOptimisticBalance } from "./useOptimisticBalance";

/*
 * Estado del portal del inversionista. Por defecto consulta la API real; la simulación solo se
 * activa con NEXT_PUBLIC_USE_MOCKS=true, valor que Next.js fija en tiempo de compilación.
 */

/** View model de la fase de ingreso, usado cuando la API responde sin sesión. */
export const LOGIN_VIEW: ParticipantViewModel = {
  phase: "login",
  round: null,
  startup: null,
  wallet: null,
  market: null,
  clock: null,
  verdict: null,
  standing: null,
  rounds: [],
  winnerStartup: null,
};

/**
 * Hook del estado real. Consulta cada 3 segundos (se detiene con la pestaña oculta). Al invertir
 * descuenta el saldo en el acto y lo revierte si el servidor rechaza.
 */
export function useParticipantRemoteState(): UseParticipantStateResult {
  const [serverVm, setServerVm] = useState<ParticipantViewModel | null>(null);
  const [status, setStatus] = useState<ParticipantLoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const optimistic = useOptimisticBalance(serverVm);

  const refresh = useCallback(async () => {
    try {
      const response = await fetchParticipantState();
      setServerVm(response === NO_SESSION ? LOGIN_VIEW : response);
      setStatus("ready");
      setErrorMessage(null);
    } catch {
      setStatus("error");
      setErrorMessage(UPDATE_FAILED_MESSAGE);
    }
  }, []);

  usePolling(refresh, EVENT_CONFIG.investorPollMs);

  const { apply, revert, settle } = optimistic;
  const invest = useCallback(
    async (amount: number): Promise<InvestmentResult> => {
      apply(amount);
      const result = await investAmount(amount);
      if (!result.ok) {
        revert();
        return result;
      }
      await refresh();
      settle();
      return result;
    },
    [apply, revert, settle, refresh],
  );

  const actions = useMemo<ParticipantActions>(() => ({ invest }), [invest]);

  return { vm: optimistic.vm, status, errorMessage, actions };
}

/** Estado del portal: API real, o simulación cuando NEXT_PUBLIC_USE_MOCKS vale "true". */
export const useParticipantState: () => UseParticipantStateResult =
  process.env.NEXT_PUBLIC_USE_MOCKS === "true" ? useParticipantMockState : useParticipantRemoteState;
