import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

/*
 * Sesiones de los roles que ingresan con código de acceso: jurado y operador. Cada rol usa una
 * cookie httpOnly distinta y un token HS256 firmado con SESSION_SECRET. Cada helper de acceso
 * exige el rol del token, de modo que una sesión de jurado nunca habilita las rutas del operador.
 */

export type SessionRole = "jury" | "operator";

/** Sesión verificada de un participante. */
export interface ActiveSession<R extends SessionRole = SessionRole> {
  role: R;
  /** Identificador del jurado o del operador en la base de datos. */
  id: string;
}

const ALGORITHM = "HS256";
const DURATION_SECONDS = 60 * 60 * 12;
const MIN_SECRET_LENGTH = 32;

const COOKIE_NAMES: Readonly<Record<SessionRole, string>> = {
  jury: "st_jury",
  operator: "st_operator",
};

/** Error que se lanza cuando la petición no tiene una sesión válida para el rol requerido. */
export class InvalidSessionError extends Error {
  readonly role: SessionRole;

  constructor(role: SessionRole) {
    super(`Se requiere una sesión válida de ${role}.`);
    this.name = "InvalidSessionError";
    this.role = role;
  }
}

/** Obtiene la clave de firma. Lanza un error si la variable no está definida o es demasiado corta. */
function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `La variable de entorno SESSION_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres.`,
    );
  }
  return new TextEncoder().encode(secret);
}

/** Firma un token con el rol y el identificador del participante. */
export async function signSession(role: SessionRole, id: string): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(`${DURATION_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Verifica la firma, la expiración y el rol del token. Devuelve el identificador del participante
 * o nulo cuando el token no es válido para el rol indicado.
 */
export async function verifySession(token: string, role: SessionRole): Promise<string | null> {
  const key = secretKey();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] });
    if (payload.role !== role || typeof payload.sub !== "string") {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

/** Opciones de la cookie de sesión. Solo se transmite por HTTPS en producción. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: DURATION_SECONDS,
  };
}

/** Establece en la respuesta la cookie de sesión del rol indicado. */
export async function startSession(
  response: NextResponse,
  role: SessionRole,
  id: string,
): Promise<void> {
  const token = await signSession(role, id);
  response.cookies.set(COOKIE_NAMES[role], token, sessionCookieOptions());
}

/** Lee la cookie del rol indicado y exige un token válido. */
async function requireSession<R extends SessionRole>(role: R): Promise<ActiveSession<R>> {
  const store = await cookies();
  const token = store.get(COOKIE_NAMES[role])?.value;
  if (token === undefined) {
    throw new InvalidSessionError(role);
  }

  const id = await verifySession(token, role);
  if (id === null) {
    throw new InvalidSessionError(role);
  }
  return { role, id };
}

/** Exige una sesión de jurado. Lanza InvalidSessionError cuando no existe o no es válida. */
export function requireJury(): Promise<ActiveSession<"jury">> {
  return requireSession("jury");
}

/** Exige una sesión de operador. Lanza InvalidSessionError cuando no existe o no es válida. */
export function requireOperator(): Promise<ActiveSession<"operator">> {
  return requireSession("operator");
}

/**
 * Convierte un InvalidSessionError en respuesta 401 para las rutas de API. Devuelve nulo cuando el
 * error no corresponde a la sesión, para que la ruta lo propague.
 */
export function noSessionResponse(error: unknown): NextResponse | null {
  if (error instanceof InvalidSessionError) {
    return NextResponse.json({ error: "INVALID_SESSION" }, { status: 401 });
  }
  return null;
}
