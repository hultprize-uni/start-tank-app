import { getInvestorSql, provisionInvestor } from "@/lib/db/investor-db";
import { getNeonAuth } from "@/server/auth/neon-auth";

/**
 * Lee la sesión de Neon Auth y devuelve la billetera del asistente.
 * Crea la fila de usuario en el primer ingreso. Devuelve null si no hay sesión.
 */
export async function getInvestorSession(): Promise<{
  userId: number;
  balance: number;
  name: string | null;
} | null> {
  const { data: session } = await getNeonAuth().getSession();
  const user = session?.user;
  if (!user) {
    return null;
  }
  const account = await provisionInvestor(getInvestorSql(), {
    externalId: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
  });
  return { userId: account.userId, balance: account.balance, name: account.name };
}
