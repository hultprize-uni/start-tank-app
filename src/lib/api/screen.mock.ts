import { useEffect, useMemo, useState } from "react";
import { EVENT_CONFIG } from "@/lib/domain/config";
import type {
  FilaInversionista,
  FilaStartup,
  RondaRef,
  ScreenPhase,
  ScreenViewModel,
  StartupGanadora,
  VotoRevelado,
} from "./screen.types";

/*
 * Fuente simulada de la pantalla del evento. Reemplazar `simularLectura` por
 * las consultas a Neon sin cambiar la interfaz `ScreenViewModel`.
 */

/** Fase que se muestra cuando no se fuerza una por query. */
export const FASE_MOCK: ScreenPhase = "MERCADO";

const RONDA_MOCK: RondaRef = {
  numero: 4,
  startup: {
    nombre: "Aqua Viva",
    ods: { numero: 6, nombre: "Agua limpia y saneamiento" },
  },
};

const INVERSIONISTAS_MOCK: FilaInversionista[] = [
  { posicion: 1, nombre: "Lucia Mendoza", saldo: 14_800 },
  { posicion: 2, nombre: "Andres Rojas", saldo: 13_250 },
  { posicion: 3, nombre: "Valeria Chavez", saldo: 12_900 },
  { posicion: 4, nombre: "Diego Paredes", saldo: 11_400 },
  { posicion: 5, nombre: "Sofia Quispe", saldo: 10_950 },
  { posicion: 6, nombre: "Mateo Huaman", saldo: 10_400 },
  { posicion: 7, nombre: "Camila Ortiz", saldo: 9_850 },
  { posicion: 8, nombre: "Renzo Villar", saldo: 9_300 },
  { posicion: 9, nombre: "Daniela Pino", saldo: 8_700 },
  { posicion: 10, nombre: "Jorge Salas", saldo: 8_150 },
  { posicion: 11, nombre: "Fernanda Lazo", saldo: 7_600 },
  { posicion: 12, nombre: "Bruno Cárdenas", saldo: 7_050 },
];

const STARTUPS_MOCK: FilaStartup[] = [
  { posicion: 1, nombre: "Aqua Viva", acumulado: 9_500, precio: 148 },
  { posicion: 2, nombre: "Huella Verde", acumulado: 8_200, precio: 141 },
  { posicion: 3, nombre: "Kallpa Energia", acumulado: 6_750, precio: 134 },
  { posicion: 4, nombre: "Tejido Andino", acumulado: 4_300, precio: 121 },
  { posicion: 5, nombre: "Nodo Salud", acumulado: 2_900, precio: 115 },
];

const VOTOS_MOCK: VotoRevelado[] = [
  { jurado: "Jurado 1", decision: "RESPALDA" },
  { jurado: "Jurado 2", decision: "RESPALDA" },
  { jurado: "Jurado 3", decision: "RECHAZA" },
  { jurado: "Jurado 4", decision: "SE_ABSTIENE" },
];

/** Precio en vivo: sube por cada `priceStepCoins` de monto acumulado, dentro de los limites. */
function calcularPrecio(acumulado: number): number {
  const { priceBase, priceMin, priceMax, priceStepCoins } = EVENT_CONFIG;
  const precio = Math.round(priceBase + acumulado / priceStepCoins);
  return Math.min(priceMax, Math.max(priceMin, precio));
}

/** Fraccion de respaldo: respaldos entre votos emitidos. Las abstenciones se excluyen. */
function calcularFraccion(votos: VotoRevelado[]): number {
  const emitidos = votos.filter((voto) => voto.decision !== "SE_ABSTIENE");
  if (emitidos.length === 0) return 0;
  const respaldos = emitidos.filter((voto) => voto.decision === "RESPALDA").length;
  return respaldos / emitidos.length;
}

function calcularMultiplicador(fraccion: number): number {
  return EVENT_CONFIG.multiplierBase + EVENT_CONFIG.multiplierSlope * fraccion;
}

function construirLiquidacion(ahora: string): ScreenViewModel {
  const montoInvertido = 7_500;
  const fraccionRespaldo = calcularFraccion(VOTOS_MOCK);
  const multiplicador = calcularMultiplicador(fraccionRespaldo);
  return {
    fase: "LIQUIDACION",
    actualizadoEn: ahora,
    ronda: RONDA_MOCK,
    votos: VOTOS_MOCK,
    fraccionRespaldo,
    multiplicador,
    montoInvertido,
    retornoRonda: Math.round(montoInvertido * multiplicador),
  };
}

function construirCierre(ahora: string): ScreenViewModel {
  const fraccionRespaldo = 0.75;
  const porcentajeInversores = 0.6;
  const ganadora: StartupGanadora = {
    nombre: STARTUPS_MOCK[0].nombre,
    ods: { numero: 6, nombre: "Agua limpia y saneamiento" },
    puntaje:
      EVENT_CONFIG.winnerWeightJury * fraccionRespaldo +
      EVENT_CONFIG.winnerWeightTraction * porcentajeInversores,
    fraccionRespaldo,
    porcentajeInversores,
  };
  return {
    fase: "CIERRE",
    actualizadoEn: ahora,
    ganadora,
    top3: INVERSIONISTAS_MOCK.slice(0, 3),
    mejorOjo: { nombre: "Valeria Chavez", aciertos: 5 },
  };
}

/** Produce el modelo de una fase. `tick` avanza con cada sondeo para simular actividad en vivo. */
export function simularLectura(fase: ScreenPhase, tick: number): ScreenViewModel {
  const ahora = new Date().toISOString();

  switch (fase) {
    case "MERCADO": {
      const acumulado = 4_000 + tick * 500;
      return {
        fase,
        actualizadoEn: ahora,
        ronda: RONDA_MOCK,
        precio: calcularPrecio(acumulado),
        acumulado,
        inversoresUnicos: 18 + tick,
      };
    }
    case "ULTIMA_LLAMADA": {
      const acumulado = 9_500 + tick * 250;
      return {
        fase,
        actualizadoEn: ahora,
        ronda: RONDA_MOCK,
        precio: calcularPrecio(acumulado),
        acumulado,
        inversoresUnicos: 31,
        segundosRestantes: Math.max(0, EVENT_CONFIG.lastCallSeconds - tick * 2),
      };
    }
    case "VOTACION":
      return {
        fase,
        actualizadoEn: ahora,
        ronda: RONDA_MOCK,
        votosEmitidos: Math.min(VOTOS_MOCK.length, 1 + Math.floor(tick / 2)),
        juradosTotal: VOTOS_MOCK.length,
      };
    case "LIQUIDACION":
      return construirLiquidacion(ahora);
    case "ENTRE_RONDAS":
      return {
        fase,
        actualizadoEn: ahora,
        rondaCerrada: RONDA_MOCK,
        inversionistas: INVERSIONISTAS_MOCK,
        startups: STARTUPS_MOCK,
      };
    case "CIERRE":
      return construirCierre(ahora);
  }
}

/**
 * Hook de lectura de la pantalla. Sondea cada `EVENT_CONFIG.screenPollMs`.
 * `faseForzada` reemplaza la fase mock; el servidor la pasa solo en desarrollo.
 */
export function useScreenState(faseForzada?: ScreenPhase): ScreenViewModel {
  const [tick, setTick] = useState(0);
  const fase = faseForzada ?? FASE_MOCK;

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), EVENT_CONFIG.screenPollMs);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => simularLectura(fase, tick), [fase, tick]);
}
