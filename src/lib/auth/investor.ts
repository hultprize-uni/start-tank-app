import { getInvestorSql, provisionInvestor } from "@/lib/db/investor-db";
import { getNeonAuth } from "@/lib/auth/neon-auth";

/**
 * Lee la sesión de Neon Auth y devuelve la billetera del asistente.
 * Crea la fila de usuario en el primer ingreso. Devuelve null si no hay sesión.
 */
export async function getInvestorSession(): Promise<{
  idUsuario: number;
  saldo: number;
  nombre: string | null;
} | null> {
  const { data: session } = await getNeonAuth().getSession();
  const user = session?.user;
  if (!user) {
    return null;
  }
  const cuenta = await provisionInvestor(getInvestorSql(), {
    idExterno: user.id,
    correo: user.email ?? null,
    nombre: user.name ?? null,
  });
  return { idUsuario: cuenta.idUsuario, saldo: cuenta.saldo, nombre: cuenta.nombre };
}
