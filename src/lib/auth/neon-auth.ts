import { createNeonAuth, type NeonAuth } from "@neon/auth/next/server";

/** Instancia del servidor de Neon Auth, creada de forma perezosa para no leer variables durante el build. */
let instance: NeonAuth | undefined;

/** Devuelve la instancia del servidor de Neon Auth. Lanza un error si falta alguna variable de entorno. */
export function getNeonAuth(): NeonAuth {
  if (instance === undefined) {
    instance = createNeonAuth({
      baseUrl: requireEnv("NEON_AUTH_BASE_URL"),
      cookies: { secret: requireEnv("NEON_AUTH_COOKIE_SECRET") },
    });
  }
  return instance;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable de entorno ausente: ${name}`);
  }
  return value;
}
