"use client";

import { useCallback, useMemo, useState } from "react";
import type { ParticipantViewModel } from "../types";

/**
 * Saldo optimista (RF-13): al invertir, el saldo baja en el acto y la ronda figura como invertida,
 * sin esperar al servidor. Si el servidor rechaza, se revierte con revert(); si acepta, el siguiente
 * estado del servidor ya trae el saldo real y se llama a settle().
 */
export function useOptimisticBalance(vm: ParticipantViewModel | null) {
  const [debit, setDebit] = useState(0);

  const view = useMemo<ParticipantViewModel | null>(() => {
    if (vm === null || vm.wallet === null || debit === 0) return vm;
    return {
      ...vm,
      wallet: {
        ...vm.wallet,
        balance: vm.wallet.balance - debit,
        investedInRound: debit,
        alreadyInvested: true,
      },
    };
  }, [vm, debit]);

  const apply = useCallback((amount: number) => setDebit(amount), []);
  const revert = useCallback(() => setDebit(0), []);

  return { vm: view, apply, revert, settle: revert };
}
