import type { Decision, OperatorAction, RoundState } from "@/shared/domain/types";

/*
 * Capa de traducción entre la base de datos y el código. La base conserva sus nombres y valores
 * (tablas, columnas, estados como 'ABIERTA' y códigos de error de las funciones SQL); el resto de
 * la aplicación trabaja con valores en inglés. Toda conversión ocurre en este módulo.
 */

/** Objetivo de Desarrollo Sostenible con su número y su nombre oficial. */
export interface Sdg {
  number: number;
  name: string;
}

/** Nombres oficiales de los Objetivos de Desarrollo Sostenible, indexados por número. */
const SDG_NAMES: Readonly<Record<number, string>> = {
  1: "Fin de la pobreza",
  2: "Hambre cero",
  3: "Salud y bienestar",
  4: "Educación de calidad",
  5: "Igualdad de género",
  6: "Agua limpia y saneamiento",
  7: "Energía asequible y no contaminante",
  8: "Trabajo decente y crecimiento económico",
  9: "Industria, innovación e infraestructura",
  10: "Reducción de las desigualdades",
  11: "Ciudades y comunidades sostenibles",
  12: "Producción y consumo responsables",
  13: "Acción por el clima",
  14: "Vida submarina",
  15: "Vida de ecosistemas terrestres",
  16: "Paz, justicia e instituciones sólidas",
  17: "Alianzas para lograr los objetivos",
};

/** Convierte un valor numérico de la base de datos. Los nulos equivalen a cero. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

/** Obtiene el número y el nombre del ODS a partir de su texto de base de datos, por ejemplo "ODS 6". */
export function parseSdg(text: string | null): Sdg {
  const matched = text?.match(/\d+/);
  const sdgNumber = matched ? Number(matched[0]) : 0;
  return { number: sdgNumber, name: SDG_NAMES[sdgNumber] ?? "" };
}

/** Estados de ronda de la base de datos y su equivalente en el dominio. */
const ROUND_STATES: Readonly<Record<string, RoundState>> = {
  PROGRAMADA: "SCHEDULED",
  ABIERTA: "OPEN",
  ULTIMA_LLAMADA: "LAST_CALL",
  CERRADA: "CLOSED",
  EN_VOTACION: "VOTING",
  LIQUIDADA: "SETTLED",
  ANULADA: "CANCELLED",
};

/** Decisiones de voto de la base de datos y su equivalente en el dominio. */
const DECISIONS_FROM_DB: Readonly<Record<string, Decision>> = {
  RESPALDA: "BACK",
  RECHAZA: "REJECT",
  SE_ABSTIENE: "ABSTAIN",
};

const DECISIONS_TO_DB: Readonly<Record<Decision, string>> = {
  BACK: "RESPALDA",
  REJECT: "RECHAZA",
  ABSTAIN: "SE_ABSTIENE",
};

/** Acciones registradas en accion_ronda y su equivalente en el dominio. */
const ACTIONS_FROM_DB: Readonly<Record<string, OperatorAction>> = {
  ABRIR: "OPEN",
  ULTIMA_LLAMADA: "LAST_CALL",
  CERRAR: "CLOSE",
  HABILITAR_VOTO: "ENABLE_VOTING",
  REVELAR: "REVEAL",
  SIGUIENTE: "NEXT",
  ANULAR_DEVOLVER: "CANCEL_REFUND",
  ANULAR_LIQUIDAR_1X: "CANCEL_SETTLE_1X",
  DESHACER: "UNDO",
  MODO_MANUAL: "MANUAL_MODE",
};

const ACTIONS_TO_DB: Readonly<Record<OperatorAction, string>> = {
  OPEN: "ABRIR",
  LAST_CALL: "ULTIMA_LLAMADA",
  CLOSE: "CERRAR",
  ENABLE_VOTING: "HABILITAR_VOTO",
  REVEAL: "REVELAR",
  NEXT: "SIGUIENTE",
  CANCEL_REFUND: "ANULAR_DEVOLVER",
  CANCEL_SETTLE_1X: "ANULAR_LIQUIDAR_1X",
  UNDO: "DESHACER",
  MANUAL_MODE: "MODO_MANUAL",
};

/** Códigos de error que devuelven las funciones SQL y su equivalente en la API. */
const ERROR_CODES: Readonly<Record<string, string>> = {
  MONTO_MINIMO: "BELOW_MINIMUM",
  RONDA_NO_EXISTE: "ROUND_NOT_FOUND",
  RONDA_NO_ABIERTA: "ROUND_NOT_OPEN",
  USUARIO_NO_EXISTE: "USER_NOT_FOUND",
  USUARIO_INACTIVO: "USER_INACTIVE",
  TOPE_RONDA_SUPERADO: "ROUND_CAP_EXCEEDED",
  SALDO_INSUFICIENTE: "INSUFFICIENT_BALANCE",
  DECISION_INVALIDA: "INVALID_DECISION",
  JURADO_NO_EXISTE: "JUROR_NOT_FOUND",
  RONDA_NO_EN_VOTACION: "ROUND_NOT_VOTING",
  VOTO_DUPLICADO: "DUPLICATE_VOTE",
  OPERADOR_NO_EXISTE: "OPERATOR_NOT_FOUND",
  SIN_JURADOS: "NO_JURORS",
  VOTOS_PENDIENTES: "PENDING_VOTES",
  SIN_VOTOS_EMITIDOS: "NO_VOTES_CAST",
  TRANSICION_NO_PERMITIDA: "TRANSITION_NOT_ALLOWED",
  OTRA_RONDA_ACTIVA: "ANOTHER_ROUND_ACTIVE",
  ACCION_INVALIDA: "INVALID_ACTION",
};

/** Convierte un estado de ronda de la base de datos. Lanza un error si el valor no se conoce. */
export function toRoundState(dbValue: string): RoundState {
  const state = ROUND_STATES[dbValue];
  if (state === undefined) {
    throw new Error(`Estado de ronda desconocido en la base de datos: ${dbValue}`);
  }
  return state;
}

/** Convierte una decisión de voto de la base de datos. Lanza un error si el valor no se conoce. */
export function toDecision(dbValue: string): Decision {
  const decision = DECISIONS_FROM_DB[dbValue];
  if (decision === undefined) {
    throw new Error(`Decisión desconocida en la base de datos: ${dbValue}`);
  }
  return decision;
}

/** Valor de la base de datos que corresponde a una decisión del dominio. */
export function toDbDecision(decision: Decision): string {
  return DECISIONS_TO_DB[decision];
}

/** Convierte la acción registrada en accion_ronda. Las acciones desconocidas se devuelven sin cambios. */
export function toActionName(dbValue: string): string {
  return ACTIONS_FROM_DB[dbValue] ?? dbValue;
}

/** Valor de la base de datos que corresponde a una acción del dominio. */
export function toDbAction(action: OperatorAction): string {
  return ACTIONS_TO_DB[action];
}

/** Convierte un código de error de una función SQL. Los códigos desconocidos se devuelven sin cambios. */
export function toErrorCode(dbCode: string): string {
  return ERROR_CODES[dbCode] ?? dbCode;
}

/** Resultado de una función SQL transaccional, con códigos y valores ya traducidos. */
export interface FunctionResult {
  ok: boolean;
  error?: string;
  /** Estado de la ronda después de la acción, cuando la función lo informa. */
  state?: RoundState;
  /** Saldo del asistente, cuando la función lo informa. */
  balance?: number | null;
}

/** Traduce el objeto jsonb que devuelve una función SQL (claves ok, error, estado y saldo). */
export function normalizeFunctionResult(raw: Record<string, unknown>): FunctionResult {
  const result: FunctionResult = { ok: raw.ok === true };
  if (typeof raw.error === "string") {
    result.error = toErrorCode(raw.error);
  }
  if (typeof raw.estado === "string" && ROUND_STATES[raw.estado] !== undefined) {
    result.state = ROUND_STATES[raw.estado];
  }
  if ("saldo" in raw) {
    result.balance = raw.saldo === null || raw.saldo === undefined ? null : Number(raw.saldo);
  }
  return result;
}
