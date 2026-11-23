import { EVENT_CONFIG } from "@/shared/domain/config";
import { formatCoins } from "../format";

/*
 * Traducción de los códigos de error de la API del inversionista a estados HTTP y mensajes en
 * español. Los mensajes se muestran al asistente, por lo que se redactan en tuteo.
 */

/** Error de la API del inversionista listo para enviarse al cliente. */
export interface ParticipantError {
  /** Estado HTTP de la respuesta. */
  status: number;
  /** Código estable que el cliente puede interpretar. */
  code: string;
  /** Mensaje en español para mostrar al asistente. */
  message: string;
}

const GENERIC_MESSAGE = "No fue posible completar la operación. Intenta de nuevo.";

/** Errores conocidos, indexados por el código que devuelve la API o la función SQL. */
const ERRORS: Readonly<Record<string, Omit<ParticipantError, "code">>> = {
  NO_SESSION: { status: 401, message: "Inicia sesión para continuar." },
  INVALID_AMOUNT: { status: 400, message: "El monto debe ser un número entero mayor que cero." },
  BELOW_MINIMUM: {
    status: 422,
    message: `El monto mínimo es ${formatCoins(EVENT_CONFIG.minInvestment)} coins.`,
  },
  ROUND_CAP_EXCEEDED: {
    status: 422,
    message: "Superas tu tope de esta ronda: 30 % de tu saldo.",
  },
  INSUFFICIENT_BALANCE: { status: 422, message: "Tu saldo no alcanza para este monto." },
  ALREADY_INVESTED: { status: 409, message: "Ya invertiste en esta ronda." },
  MARKET_PAUSED: { status: 409, message: "Mercado en pausa. Espera a que el conductor lo reanude." },
  ROUND_NOT_OPEN: { status: 409, message: "El mercado ya cerró." },
  ROUND_NOT_FOUND: { status: 409, message: "No hay una ronda disponible para invertir." },
  USER_NOT_FOUND: { status: 404, message: "No encontramos tu cuenta de inversionista." },
};

/**
 * Devuelve el estado HTTP, el código y el mensaje para un código de error. Con el tope informado
 * por la función SQL, el mensaje lo incluye. Los códigos desconocidos usan un mensaje genérico.
 */
export function participantError(code: string | undefined, cap?: number): ParticipantError {
  if (code === "ROUND_CAP_EXCEEDED" && cap !== undefined) {
    return { code, status: 422, message: `Tu tope en esta ronda es ${formatCoins(cap)} coins.` };
  }
  if (code !== undefined && Object.prototype.hasOwnProperty.call(ERRORS, code)) {
    return { code, ...ERRORS[code] };
  }
  return { code: code ?? "INTERNAL_ERROR", status: 500, message: GENERIC_MESSAGE };
}
