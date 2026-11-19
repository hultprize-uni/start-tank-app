import { EVENT_CONFIG } from "@/shared/domain/config";
import { API_ROUTES } from "@/shared/lib/api-routes";
import type { ScreenPhase, ScreenViewModel } from "../types";

/*
 * Lectura del estado de la pantalla. El cliente consulta la ruta GET de solo lectura cada
 * `EVENT_CONFIG.screenPollMs` y no conserva estado fuera de memoria: al recargar la página, la
 * primera consulta reconstruye la vista. Ninguna función de este módulo ejecuta escrituras.
 */

/** Fases válidas del view model. Se usan para validar la respuesta del servidor. */
const VALID_PHASES: readonly ScreenPhase[] = [
  "WAITING",
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
  const { phase, updatedAt } = body as { phase?: unknown; updatedAt?: unknown };
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
    const response = await fetchImpl(API_ROUTES.screen.state, {
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
      return { vm: result.vm, receivedAt, offline: false };
    case "no_rounds":
      return { vm: null, receivedAt, offline: false };
    case "error":
      return { ...previous, offline: true };
  }
}

/**
 * Segundos restantes de la última llamada, expresados con la hora del servidor.
 * `updatedAt` es el instante del servidor en que se calculó `secondsRemaining`, de modo que el
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
 * Ejecuta `poll` de inmediato y luego cada `intervalMs`. Una consulta nueva no se inicia
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
