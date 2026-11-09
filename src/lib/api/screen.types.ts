import type { Decision } from "@/lib/domain/types";

/** Fases de la pantalla del evento. Cada una corresponde a una fila del cuadro de la especificacion (seccion 2.6). */
export type ScreenPhase =
  | "MERCADO"
  | "ULTIMA_LLAMADA"
  | "VOTACION"
  | "LIQUIDACION"
  | "ENTRE_RONDAS"
  | "CIERRE";

export interface OdsRef {
  numero: number;
  nombre: string;
}

/** Startup en turno o recien liquidada. */
export interface StartupRef {
  nombre: string;
  ods: OdsRef;
}

/** Datos de la ronda que la pantalla proyecta. */
export interface RondaRef {
  numero: number;
  startup: StartupRef;
}

/** Voto revelado de un jurado. Se muestra solo en la fase de liquidacion. */
export interface VotoRevelado {
  jurado: string;
  decision: Decision;
}

/** Fila del leaderboard de inversionistas. */
export interface FilaInversionista {
  posicion: number;
  nombre: string;
  saldo: number;
}

/** Fila del acumulado por startup. */
export interface FilaStartup {
  posicion: number;
  nombre: string;
  acumulado: number;
  precio: number;
}

interface ScreenBase {
  fase: ScreenPhase;
  /** Marca de tiempo ISO de la ultima lectura. */
  actualizadoEn: string;
}

interface RondaEnCurso extends ScreenBase {
  ronda: RondaRef;
}

export interface MercadoAbierto extends RondaEnCurso {
  fase: "MERCADO";
  precio: number;
  acumulado: number;
  inversoresUnicos: number;
}

export interface UltimaLlamada extends RondaEnCurso {
  fase: "ULTIMA_LLAMADA";
  precio: number;
  acumulado: number;
  inversoresUnicos: number;
  /** Segundos restantes de la cuenta regresiva al momento de la lectura. */
  segundosRestantes: number;
}

export interface Votacion extends RondaEnCurso {
  fase: "VOTACION";
  votosEmitidos: number;
  juradosTotal: number;
}

export interface Liquidacion extends RondaEnCurso {
  fase: "LIQUIDACION";
  votos: VotoRevelado[];
  fraccionRespaldo: number;
  multiplicador: number;
  montoInvertido: number;
  retornoRonda: number;
}

export interface EntreRondas extends ScreenBase {
  fase: "ENTRE_RONDAS";
  rondaCerrada: RondaRef;
  inversionistas: FilaInversionista[];
  startups: FilaStartup[];
}

export interface StartupGanadora {
  nombre: string;
  ods: OdsRef;
  puntaje: number;
  fraccionRespaldo: number;
  porcentajeInversores: number;
}

export interface MejorOjo {
  nombre: string;
  aciertos: number;
}

export interface Cierre extends ScreenBase {
  fase: "CIERRE";
  ganadora: StartupGanadora;
  top3: FilaInversionista[];
  mejorOjo: MejorOjo;
}

/** Modelo completo que consume la pantalla. Discriminado por `fase`. */
export type ScreenViewModel =
  | MercadoAbierto
  | UltimaLlamada
  | Votacion
  | Liquidacion
  | EntreRondas
  | Cierre;
