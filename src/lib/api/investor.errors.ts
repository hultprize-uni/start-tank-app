import { EVENT_CONFIG } from "@/lib/domain/config";

/*
 * Traducción de los códigos de error de la API del inversionista a estados HTTP y mensajes en
 * español. Los mensajes se muestran al asistente, por lo que se redactan en tuteo.
 */

/** Error de la API del inversionista listo para enviarse al cliente. */
export interface ErrorInversionista {
  /** Estado HTTP de la respuesta. */
  estado: number;
  /** Código estable que el cliente puede interpretar. */
  codigo: string;
  /** Mensaje en español para mostrar al asistente. */
  mensaje: string;
}

const MENSAJE_GENERICO = "No fue posible completar la operación. Intenta de nuevo.";

/** Errores conocidos, indexados por el código que devuelve la API o la función SQL. */
const ERRORES: Readonly<Record<string, Omit<ErrorInversionista, "codigo">>> = {
  SIN_SESION: { estado: 401, mensaje: "Inicia sesión para continuar." },
  MONTO_INVALIDO: { estado: 400, mensaje: "El monto debe ser un número entero mayor que cero." },
  MONTO_MINIMO: {
    estado: 422,
    mensaje: `El monto mínimo de compra es ${EVENT_CONFIG.minInvestment} coins.`,
  },
  TOPE_RONDA_SUPERADO: {
    estado: 422,
    mensaje: "Superas tu tope de esta ronda, que equivale al 30 % de tu saldo al abrirla.",
  },
  SALDO_INSUFICIENTE: { estado: 422, mensaje: "Tu saldo no alcanza para este monto." },
  RONDA_NO_ABIERTA: { estado: 409, mensaje: "La ronda no está abierta para invertir." },
  RONDA_NO_EXISTE: { estado: 409, mensaje: "No hay una ronda disponible para invertir." },
  USUARIO_NO_EXISTE: { estado: 404, mensaje: "No encontramos tu cuenta de inversionista." },
  USUARIO_INACTIVO: { estado: 403, mensaje: "Tu cuenta no está activa." },
};

/**
 * Devuelve el estado HTTP, el código y el mensaje para un código de error. Los códigos no
 * reconocidos usan un mensaje genérico con estado 500.
 */
export function errorInversionista(codigo: string | undefined): ErrorInversionista {
  if (codigo !== undefined && Object.prototype.hasOwnProperty.call(ERRORES, codigo)) {
    return { codigo, ...ERRORES[codigo] };
  }
  return { codigo: codigo ?? "ERROR_INTERNO", estado: 500, mensaje: MENSAJE_GENERICO };
}
