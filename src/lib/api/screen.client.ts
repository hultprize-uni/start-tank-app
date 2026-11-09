import { useEffect, useMemo, useReducer, useState } from "react";
import { EVENT_CONFIG } from "@/lib/domain/config";
import { FASE_MOCK, simularLectura } from "./screen.mock";
import type { ScreenPhase, ScreenViewModel } from "./screen.types";

/*
 * Lectura del estado de la pantalla. El cliente consulta la ruta GET de solo lectura cada
 * `EVENT_CONFIG.screenPollMs` y no conserva estado fuera de memoria: al recargar la página, la
 * primera consulta reconstruye la vista. Ninguna función de este módulo ejecuta escrituras.
 */

/** Ruta pública de lectura de la pantalla. */
export const RUTA_PANTALLA = "/api/pantalla";

/** Fases válidas del view model. Se usan para validar la respuesta del servidor. */
const FASES_VALIDAS: readonly ScreenPhase[] = [
  "MERCADO",
  "ULTIMA_LLAMADA",
  "VOTACION",
  "LIQUIDACION",
  "ENTRE_RONDAS",
  "CIERRE",
];

/** Resultado de una consulta a la ruta de pantalla. */
export type ResultadoConsulta =
  | { tipo: "lectura"; vm: ScreenViewModel }
  | { tipo: "sin_rondas" }
  | { tipo: "error" };

/** Estado que el cliente conserva entre sondeos. */
export interface EstadoPantalla {
  /** Última lectura válida. Nulo mientras no haya lectura o cuando el evento no tiene rondas. */
  vm: ScreenViewModel | null;
  /** Instante local, en milisegundos, en que se recibió `vm`. */
  recibidoEn: number | null;
  /** Verdadero cuando la última consulta falló. `vm` conserva la lectura anterior. */
  sinConexion: boolean;
}

/** Valor con que inicia el cliente antes de la primera consulta. */
export const ESTADO_INICIAL: EstadoPantalla = { vm: null, recibidoEn: null, sinConexion: false };

/** Indica si el cuerpo de la respuesta tiene la forma mínima de un view model. */
function esViewModel(cuerpo: unknown): cuerpo is ScreenViewModel {
  if (typeof cuerpo !== "object" || cuerpo === null) return false;
  const { fase, actualizadoEn } = cuerpo as { fase?: unknown; actualizadoEn?: unknown };
  return (
    typeof fase === "string" &&
    FASES_VALIDAS.includes(fase as ScreenPhase) &&
    typeof actualizadoEn === "string" &&
    !Number.isNaN(Date.parse(actualizadoEn))
  );
}

/**
 * Consulta la ruta de pantalla con GET y sin caché. Un fallo de red, un estado HTTP distinto de
 * 200 y 404, o una respuesta mal formada se reporta como `error`. El 404 indica que el evento aún
 * no tiene rondas y se reporta como `sin_rondas`.
 */
export async function consultarPantalla(
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoConsulta> {
  try {
    const respuesta = await fetchImpl(RUTA_PANTALLA, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (respuesta.status === 404) return { tipo: "sin_rondas" };
    if (!respuesta.ok) return { tipo: "error" };
    const cuerpo: unknown = await respuesta.json();
    return esViewModel(cuerpo) ? { tipo: "lectura", vm: cuerpo } : { tipo: "error" };
  } catch {
    return { tipo: "error" };
  }
}

/**
 * Aplica el resultado de una consulta al estado anterior. Un error conserva la última lectura
 * válida y solo marca la conexión como interrumpida.
 */
export function reducirEstado(
  anterior: EstadoPantalla,
  resultado: ResultadoConsulta,
  recibidoEn: number,
): EstadoPantalla {
  switch (resultado.tipo) {
    case "lectura":
      return { vm: resultado.vm, recibidoEn, sinConexion: false };
    case "sin_rondas":
      return { vm: null, recibidoEn, sinConexion: false };
    case "error":
      return { ...anterior, sinConexion: true };
  }
}

/**
 * Segundos restantes de la última llamada, expresados con la hora del servidor.
 * `actualizadoEn` es el instante del servidor en que se calculó `segundosRestantes`, de modo que el
 * cierre ocurre en `actualizadoEn + segundosRestantes`. La hora actual del servidor se estima
 * sumando al reloj local el desfase medido en la recepción. Como el desfase se cancela, el
 * resultado no depende de la hora local del proyector.
 */
export function segundosRestantesEnVivo(
  vm: Extract<ScreenViewModel, { fase: "ULTIMA_LLAMADA" }>,
  recibidoEn: number,
  ahora: number,
): number {
  const instanteServidor = Date.parse(vm.actualizadoEn);
  const desfaseMs = instanteServidor - recibidoEn;
  const finServidor = instanteServidor + vm.segundosRestantes * 1000;
  const horaServidorAhora = ahora + desfaseMs;
  const restante = Math.ceil((finServidor - horaServidorAhora) / 1000);
  return Math.min(EVENT_CONFIG.lastCallSeconds, Math.max(0, restante));
}

/**
 * Ejecuta `consultar` de inmediato y luego cada `intervaloMs`. Una consulta nueva no se inicia
 * mientras la anterior sigue en curso. Devuelve la función que detiene el sondeo.
 */
export function iniciarSondeo(opciones: {
  intervaloMs: number;
  consultar: () => Promise<void>;
}): () => void {
  let enCurso = false;
  const disparar = () => {
    if (enCurso) return;
    enCurso = true;
    void opciones.consultar().finally(() => {
      enCurso = false;
    });
  };
  disparar();
  const id = setInterval(disparar, opciones.intervaloMs);
  return () => clearInterval(id);
}

/** Estado de la pantalla que consumen los componentes de fase. */
export interface LecturaPantalla {
  /** View model listo para presentar. Nulo cuando aún no hay datos o el evento no tiene rondas. */
  vm: ScreenViewModel | null;
  /** Verdadero cuando la última consulta falló y se muestra la lectura anterior. */
  sinConexion: boolean;
}

/*
 * Hook de lectura de la pantalla. Por defecto sondea `GET /api/pantalla`. Con
 * `NEXT_PUBLIC_USE_MOCKS=true`, o cuando la página recibe `faseForzada` en desarrollo, usa la
 * fuente simulada de `screen.mock.ts` y no realiza consultas de red.
 */
export function useScreenState(faseForzada?: ScreenPhase): LecturaPantalla {
  const simulada = process.env.NEXT_PUBLIC_USE_MOCKS === "true" || faseForzada !== undefined;
  const [tick, setTick] = useState(0);
  const [estado, setEstado] = useState<EstadoPantalla>(ESTADO_INICIAL);
  const [, repintar] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (simulada) return;
    return iniciarSondeo({
      intervaloMs: EVENT_CONFIG.screenPollMs,
      consultar: async () => {
        const resultado = await consultarPantalla();
        const recibidoEn = Date.now();
        setEstado((anterior) => reducirEstado(anterior, resultado, recibidoEn));
      },
    });
  }, [simulada]);

  useEffect(() => {
    if (!simulada) return;
    const id = setInterval(() => setTick((t) => t + 1), EVENT_CONFIG.screenPollMs);
    return () => clearInterval(id);
  }, [simulada]);

  const base = useMemo<EstadoPantalla>(() => {
    if (!simulada) return estado;
    const vm = simularLectura(faseForzada ?? FASE_MOCK, tick);
    return { vm, recibidoEn: Date.parse(vm.actualizadoEn), sinConexion: false };
  }, [simulada, faseForzada, tick, estado]);

  const enUltimaLlamada = base.vm?.fase === "ULTIMA_LLAMADA";

  // La cuenta regresiva se recalcula cada segundo mientras la fase es ULTIMA_LLAMADA.
  useEffect(() => {
    if (!enUltimaLlamada) return;
    const id = setInterval(repintar, 1000);
    return () => clearInterval(id);
  }, [enUltimaLlamada]);

  if (base.vm !== null && base.vm.fase === "ULTIMA_LLAMADA" && base.recibidoEn !== null) {
    const segundosRestantes = segundosRestantesEnVivo(base.vm, base.recibidoEn, Date.now());
    return {
      vm: { ...base.vm, segundosRestantes },
      sinConexion: base.sinConexion,
    };
  }
  return { vm: base.vm, sinConexion: base.sinConexion };
}
