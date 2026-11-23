import { getParticipantSql, provisionParticipant } from "./provisioning";
import { getNeonAuth } from "@/server/auth/neon-auth";

/** Duración de la sesión del asistente (RF-05): 2 horas desde que ingresó con Google. */
export const PARTICIPANT_SESSION_MS = 2 * 60 * 60 * 1000;

/** Indica si una sesión creada en createdAt ya venció. Sin fecha conocida, se acepta. */
export function isParticipantSessionExpired(
  createdAt: string | Date | undefined,
  now: number = Date.now(),
): boolean {
  if (createdAt === undefined) return false;
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && now - created > PARTICIPANT_SESSION_MS;
}

/**
 * Lee la sesión de Neon Auth y devuelve la billetera del asistente.
 * Crea la fila de usuario en el primer ingreso. Devuelve null si no hay sesión o si venció.
 */
export async function getParticipantSession(): Promise<{
  userId: number;
  balance: number;
  name: string | null;
} | null> {
  const { data } = await getNeonAuth().getSession();
  const user = data?.user;
  if (!user) {
    return null;
  }
  // Neon Auth no permite fijar la duración por rol; la aplicación vence la sesión a las 2 horas.
  const createdAt = (data as { session?: { createdAt?: string | Date } }).session?.createdAt;
  if (isParticipantSessionExpired(createdAt)) {
    return null;
  }
  const account = await provisionParticipant(getParticipantSql(), {
    externalId: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
  });
  return { userId: account.userId, balance: account.balance, name: account.name };
}
