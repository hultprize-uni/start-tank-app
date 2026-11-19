import { useEffect, useMemo, useReducer, useState } from "react";
import { EVENT_CONFIG } from "@/lib/domain/config";
import { MOCK_PHASE, simulateReading } from "./screen.mock";
import type { ScreenPhase, ScreenViewModel } from "./screen.types";

/*
 * Lectura del estado de la pantalla. El cliente consulta la ruta GET de solo lectura cada
 * `EVENT_CONFIG.screenPollMs` y no conserva estado fuera de memoria: al recargar la página, la
 * primera consulta reconstruye la vista. Ninguna función de este módulo ejecuta escrituras.
 */

/** Ruta pública de lectura de la pantalla. */
export const SCREEN_ROUTE = "/api/pantalla";

/** Fases válidas del view model. Se usan para validar la respuesta del servidor. */
const VALID_PHASES: readonly ScreenPhase[] = [
  "MARKET",
  "LAST_CALL",
  "VOTING",
  "SETTLEMENT",
  "BETWEEN_ROUNDS",
  "CLOSING",
];

/** Resultado de una consulta a la ruta de pantalla. */
export type QueryResult =
  | { kind: "reading"; vm: ScreenViewModel }
  | { kind: "no_rounds" }
  | { kind: "error" };

/** Estado que el cliente conserva entre sondeos. */
export interface ScreenReadState {
  /** Última lectura válida. Nulo mientras no haya lectura o cuando el evento no tiene rondas. */
  vm: ScreenViewModel | null;
  /** Instante local, en milisegundos, en que se recibió `vm`. */
  receivedAt: number | null;
  /** Verdadero cuando la última consulta falló. `vm` conserva la lectura anterior. */
  offline: boolean;
}

/** Valor con que inicia el cliente antes de la primera consulta. */
export const INITIAL_STATE: ScreenReadState = { vm: null, receivedAt: null, offline: false };

/** Indica si el cuerpo de la respuesta tiene la forma mínima de un view model. */
function isViewModel(body: unknown): body is ScreenViewModel {
  if (typeof body !== "object" || body === null) return false;
  const { phase: phase, updatedAt: updatedAt } = body as { phase?: unknown; updatedAt?: unknown };
  return (
    typeof phase === "string" &&
    VALID_PHASES.includes(phase as ScreenPhase) &&
    typeof updatedAt === "string" &&
    !Number.isNaN(Date.parse(updatedAt))
  );
}

/**
 * Consulta la ruta de pantalla con GET y sin caché. Un fallo de red, un estado HTTP distinto de
 * 200 y 404, o una respuesta mal formada se reporta como `error`. El 404 indica que el evento aún
 * no tiene rondas y se reporta como `sin_rondas`.
 */
export async function fetchScreen(
  fetchImpl: typeof fetch = fetch,
): Promise<QueryResult> {
  try {
    const response = await fetchImpl(SCREEN_ROUTE, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return { kind: "no_rounds" };
    if (!response.ok) return { kind: "error" };
    const body: unknown = await response.json();
    return isViewModel(body) ? { kind: "reading", vm: body } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Aplica el resultado de una consulta al estado anterior. Un error conserva la última lectura
 * válida y solo marca la conexión como interrumpida.
 */
export function reduceState(
  previous: ScreenReadState,
  result: QueryResult,
  receivedAt: number,
): ScreenReadState {
  switch (result.kind) {
    case "reading":
      return { vm: result.vm, receivedAt: receivedAt, offline: false };
    case "no_rounds":
      return { vm: null, receivedAt: receivedAt, offline: false };
    case "error":
      return { ...previous, offline: true };
  }
}

/**
 * Segundos restantes de la última llamada, expresados con la hora del servidor.
 * `actualizadoEn` es el instante del servidor en que se calculó `segundosRestantes`, de modo que el
 * cierre ocurre en `actualizadoEn + segundosRestantes`. La hora actual del servidor se estima
 * sumando al reloj local el desfase medido en la recepción. Como el desfase se cancela, el
 * resultado no depende de la hora local del proyector.
 */
export function liveSecondsRemaining(
  vm: Extract<ScreenViewModel, { phase: "LAST_CALL" }>,
  receivedAt: number,
  now: number,
): number {
  const serverInstant = Date.parse(vm.updatedAt);
  const offsetMs = serverInstant - receivedAt;
  const serverEnd = serverInstant + vm.secondsRemaining * 1000;
  const serverNow = now + offsetMs;
  const remaining = Math.ceil((serverEnd - serverNow) / 1000);
  return Math.min(EVENT_CONFIG.lastCallSeconds, Math.max(0, remaining));
}

/**
 * Ejecuta `consultar` de inmediato y luego cada `intervaloMs`. Una consulta nueva no se inicia
 * mientras la anterior sigue en curso. Devuelve la función que detiene el sondeo.
 */
export function startPolling(options: {
  intervalMs: number;
  poll: () => Promise<void>;
}): () => void {
  let running = false;
  const trigger = () => {
    if (running) return;
    running = true;
    void options.poll().finally(() => {
      running = false;
    });
  };
  trigger();
  const id = setInterval(trigger, options.intervalMs);
  return () => clearInterval(id);
}

/** Estado de la pantalla que consumen los componentes de fase. */
export interface ScreenReading {
  /** View model listo para presentar. Nulo cuando aún no hay datos o el evento no tiene rondas. */
  vm: ScreenViewModel | null;
  /** Verdadero cuando la última consulta falló y se muestra la lectura anterior. */
  offline: boolean;
}

/*
 * Hook de lectura de la pantalla. Por defecto sondea `GET /api/pantalla`. Con
 * `NEXT_PUBLIC_USE_MOCKS=true`, o cuando la página recibe `faseForzada` en desarrollo, usa la
 * fuente simulada de `screen.mock.ts` y no realiza consultas de red.
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

  // La cuenta regresiva se recalcula cada segundo mientras la fase es ULTIMA_LLAMADA.
  useEffect(() => {
    if (!inLastCall) return;
    const id = setInterval(repaint, 1000);
    return () => clearInterval(id);
  }, [inLastCall]);

  if (base.vm !== null && base.vm.phase === "LAST_CALL" && base.receivedAt !== null) {
    const secondsRemaining = liveSecondsRemaining(base.vm, base.receivedAt, Date.now());
    return {
      vm: { ...base.vm, secondsRemaining: secondsRemaining },
      offline: base.offline,
    };
  }
  return { vm: base.vm, offline: base.offline };
}
