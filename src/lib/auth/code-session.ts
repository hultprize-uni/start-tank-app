import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

/*
 * Sesiones de los roles que ingresan con código de acceso: jurado y operador. Cada rol usa una
 * cookie httpOnly distinta y un token HS256 firmado con SESSION_SECRET. Cada helper de acceso
 * exige el rol del token, de modo que una sesión de jurado nunca habilita las rutas del operador.
 */

export type RolSesion = "jurado" | "operador";

/** Sesión verificada de un participante. */
export interface SesionActiva<R extends RolSesion = RolSesion> {
  rol: R;
  /** Identificador del jurado o del operador en la base de datos. */
  id: string;
}

const ALGORITMO = "HS256";
const DURACION_SEGUNDOS = 60 * 60 * 12;
const LONGITUD_MINIMA_SECRETO = 32;

const NOMBRE_COOKIE: Readonly<Record<RolSesion, string>> = {
  jurado: "st_jurado",
  operador: "st_operador",
};

/** Error que se lanza cuando la petición no tiene una sesión válida para el rol requerido. */
export class SesionNoValidaError extends Error {
  readonly rol: RolSesion;

  constructor(rol: RolSesion) {
    super(`Se requiere una sesión válida de ${rol}.`);
    this.name = "SesionNoValidaError";
    this.rol = rol;
  }
}

/** Obtiene la clave de firma. Lanza un error si la variable no está definida o es demasiado corta. */
function claveSecreta(): Uint8Array {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto || secreto.length < LONGITUD_MINIMA_SECRETO) {
    throw new Error(
      `La variable de entorno SESSION_SECRET debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres.`,
    );
  }
  return new TextEncoder().encode(secreto);
}

/** Firma un token con el rol y el identificador del participante. */
export async function firmarSesion(rol: RolSesion, id: string): Promise<string> {
  return new SignJWT({ rol })
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .sign(claveSecreta());
}

/**
 * Verifica la firma, la expiración y el rol del token. Devuelve el identificador del participante
 * o nulo cuando el token no es válido para el rol indicado.
 */
export async function verificarSesion(token: string, rol: RolSesion): Promise<string | null> {
  const clave = claveSecreta();
  try {
    const { payload } = await jwtVerify(token, clave, { algorithms: [ALGORITMO] });
    if (payload.rol !== rol || typeof payload.sub !== "string") {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

/** Opciones de la cookie de sesión. Solo se transmite por HTTPS en producción. */
export function opcionesCookieSesion() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: DURACION_SEGUNDOS,
  };
}

/** Establece en la respuesta la cookie de sesión del rol indicado. */
export async function iniciarSesion(
  respuesta: NextResponse,
  rol: RolSesion,
  id: string,
): Promise<void> {
  const token = await firmarSesion(rol, id);
  respuesta.cookies.set(NOMBRE_COOKIE[rol], token, opcionesCookieSesion());
}

/** Lee la cookie del rol indicado y exige un token válido. */
async function requerirSesion<R extends RolSesion>(rol: R): Promise<SesionActiva<R>> {
  const almacen = await cookies();
  const token = almacen.get(NOMBRE_COOKIE[rol])?.value;
  if (token === undefined) {
    throw new SesionNoValidaError(rol);
  }

  const id = await verificarSesion(token, rol);
  if (id === null) {
    throw new SesionNoValidaError(rol);
  }
  return { rol, id };
}

/** Exige una sesión de jurado. Lanza SesionNoValidaError cuando no existe o no es válida. */
export function requireJury(): Promise<SesionActiva<"jurado">> {
  return requerirSesion("jurado");
}

/** Exige una sesión de operador. Lanza SesionNoValidaError cuando no existe o no es válida. */
export function requireOperator(): Promise<SesionActiva<"operador">> {
  return requerirSesion("operador");
}

/**
 * Convierte un SesionNoValidaError en respuesta 401 para las rutas de API. Devuelve nulo cuando el
 * error no corresponde a la sesión, para que la ruta lo propague.
 */
export function respuestaSinSesion(error: unknown): NextResponse | null {
  if (error instanceof SesionNoValidaError) {
    return NextResponse.json({ error: "SESION_NO_VALIDA" }, { status: 401 });
  }
  return null;
}
