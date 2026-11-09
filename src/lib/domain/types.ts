export type RoundState =
  | "PROGRAMADA"
  | "ABIERTA"
  | "ULTIMA_LLAMADA"
  | "CERRADA"
  | "EN_VOTACION"
  | "LIQUIDADA"
  | "ANULADA";

export type Decision = "RESPALDA" | "RECHAZA" | "SE_ABSTIENE";

export type OperatorAction =
  | "ABRIR"
  | "ULTIMA_LLAMADA"
  | "CERRAR"
  | "HABILITAR_VOTO"
  | "REVELAR"
  | "SIGUIENTE"
  | "ANULAR_DEVOLVER"
  | "ANULAR_LIQUIDAR_1X"
  | "DESHACER"
  | "MODO_MANUAL";

export interface VerdictResult {
  backs: number;
  voters: number;
  fraction: number;
  multiplier: number;
}
