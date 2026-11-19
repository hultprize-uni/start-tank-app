import { EVENT_CONFIG } from "@/shared/domain/config";

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
    message: `El monto mínimo de compra es ${EVENT_CONFIG.minInvestment} coins.`,
  },
  ROUND_CAP_EXCEEDED: {
    status: 422,
    message: "Superas tu tope de esta ronda, que equivale al 30 % de tu saldo al abrirla.",
  },
  INSUFFICIENT_BALANCE: { status: 422, message: "Tu saldo no alcanza para este monto." },
  ROUND_NOT_OPEN: { status: 409, message: "La ronda no está abierta para invertir." },
  ROUND_NOT_FOUND: { status: 409, message: "No hay una ronda disponible para invertir." },
  USER_NOT_FOUND: { status: 404, message: "No encontramos tu cuenta de inversionista." },
  USER_INACTIVE: { status: 403, message: "Tu cuenta no está activa." },
};

/**
 * Devuelve el estado HTTP, el código y el mensaje para un código de error. Los códigos no
 * reconocidos usan un mensaje genérico con estado 500.
 */
export function participantError(code: string | undefined): ParticipantError {
  if (code !== undefined && Object.prototype.hasOwnProperty.call(ERRORS, code)) {
    return { code, ...ERRORS[code] };
  }
  return { code: code ?? "INTERNAL_ERROR", status: 500, message: GENERIC_MESSAGE };
}
