"use client";

import { useCallback, useMemo, useState } from "react";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { USE_MOCKS } from "@/shared/lib/env";
import { usePolling } from "@/shared/lib/use-polling";
import { fetchScreen } from "../api/client";
import { mockScreen } from "../api/mock";
import type { ScreenViewModel, StagePhase } from "../types";

export interface ScreenReading {
  /** Modelo vigente; nulo mientras no hay datos o el evento no tiene rondas. */
  vm: ScreenViewModel | null;
  /** La última consulta falló: se muestra la lectura anterior. */
  offline: boolean;
  /** El evento aún no tiene rondas cargadas. */
  empty: boolean;
}

/**
 * Estado del escenario (RF-25). Consulta cada 2 segundos y cada 1 durante la votación y el
 * veredicto, para que la revelación llegue en menos de 1 segundo (RNF-04). Con datos de muestra o
 * con una fase forzada en desarrollo no consulta la red.
 */
export function useScreenState(forcedPhase?: StagePhase): ScreenReading {
  const simulated = USE_MOCKS || forcedPhase !== undefined;
  const [reading, setReading] = useState<ScreenReading>({ vm: null, offline: false, empty: false });

  const poll = useCallback(async () => {
    const result = await fetchScreen();
    setReading((previous) =>
      result.status === "ok"
        ? { vm: result.vm, offline: false, empty: false }
        : result.status === "empty"
          ? { vm: null, offline: false, empty: true }
          : { ...previous, offline: true },
    );
  }, []);

  const fast = reading.vm?.phase === "VOTING" || reading.vm?.phase === "REVEAL";
  usePolling(poll, fast ? EVENT_CONFIG.screenVotingPollMs : EVENT_CONFIG.screenPollMs, !simulated);

  const mock = useMemo(
    () => (simulated ? mockScreen(forcedPhase ?? "MARKET") : null),
    [simulated, forcedPhase],
  );
  return mock ? { vm: mock, offline: false, empty: false } : reading;
}
