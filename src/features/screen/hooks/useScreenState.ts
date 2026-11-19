import { useEffect, useMemo, useReducer, useState } from "react";
import { EVENT_CONFIG } from "@/shared/domain/config";
import {
  INITIAL_STATE,
  fetchScreen,
  liveSecondsRemaining,
  reduceState,
  startPolling,
  type ScreenReadState,
} from "../api/client";
import { MOCK_PHASE, simulateReading } from "../api/mock";
import type { ScreenPhase, ScreenViewModel } from "../types";

/** Estado de la pantalla que consumen los componentes de fase. */
export interface ScreenReading {
  /** View model listo para presentar. Nulo cuando aún no hay datos o el evento no tiene rondas. */
  vm: ScreenViewModel | null;
  /** Verdadero cuando la última consulta falló y se muestra la lectura anterior. */
  offline: boolean;
}

/*
 * Hook de lectura de la pantalla. Por defecto sondea la ruta de estado de la pantalla (API_ROUTES.screen.state). Con
 * `NEXT_PUBLIC_USE_MOCKS=true`, o cuando la página recibe `forcedPhase` en desarrollo, usa la
 * fuente simulada de `api/mock.ts` y no realiza consultas de red.
 */
export function useScreenState(forcedPhase?: ScreenPhase): ScreenReading {
  const simulated = process.env.NEXT_PUBLIC_USE_MOCKS === "true" || forcedPhase !== undefined;
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<ScreenReadState>(INITIAL_STATE);
  const [, repaint] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (simulated) return;
    return startPolling({
      intervalMs: EVENT_CONFIG.screenPollMs,
      poll: async () => {
        const result = await fetchScreen();
        const receivedAt = Date.now();
        setState((previous) => reduceState(previous, result, receivedAt));
      },
    });
  }, [simulated]);

  useEffect(() => {
    if (!simulated) return;
    const id = setInterval(() => setTick((t) => t + 1), EVENT_CONFIG.screenPollMs);
    return () => clearInterval(id);
  }, [simulated]);

  const base = useMemo<ScreenReadState>(() => {
    if (!simulated) return state;
    const vm = simulateReading(forcedPhase ?? MOCK_PHASE, tick);
    return { vm, receivedAt: Date.parse(vm.updatedAt), offline: false };
  }, [simulated, forcedPhase, tick, state]);

  const inLastCall = base.vm?.phase === "LAST_CALL";

  // La cuenta regresiva se recalcula cada segundo mientras la fase es LAST_CALL.
  useEffect(() => {
    if (!inLastCall) return;
    const id = setInterval(repaint, 1000);
    return () => clearInterval(id);
  }, [inLastCall]);

  if (base.vm !== null && base.vm.phase === "LAST_CALL" && base.receivedAt !== null) {
    const secondsRemaining = liveSecondsRemaining(base.vm, base.receivedAt, Date.now());
    return {
      vm: { ...base.vm, secondsRemaining },
      offline: base.offline,
    };
  }
  return { vm: base.vm, offline: base.offline };
}
