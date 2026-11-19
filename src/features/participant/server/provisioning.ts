import { neon } from "@neondatabase/serverless";

/** Fila devuelta por la consulta de aprovisionamiento de la tabla usuario. */
export interface ParticipantRow {
  id_usuario: number | string;
  saldo_actual: number | string;
  nombre: string | null;
}

/** Función de consulta con plantillas etiquetadas, compatible con el cliente de Neon. */
export type ParticipantSql = (
  strings: TemplateStringsArray,
  ...params: unknown[]
) => Promise<ParticipantRow[]>;

/** Datos del asistente proporcionados por Neon Auth. */
export interface ParticipantIdentity {
  /** Identificador del usuario en Neon Auth. */
  externalId: string;
  email: string | null;
  name: string | null;
}

/** Billetera del inversionista tal como se expone a la aplicación. */
export interface ParticipantAccount {
  userId: number;
  balance: number;
  name: string | null;
}

let client: ParticipantSql | undefined;

/** Devuelve el cliente de Neon. Se crea en la primera llamada para no leer DATABASE_URL durante el build. */
export function getParticipantSql(): ParticipantSql {
  if (client !== undefined) {
    return client;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Variable de entorno ausente: DATABASE_URL");
  }
  // El tipo de filas del driver es genérico; la forma de InvestorRow se valida en provisionInvestor.
  const sql = neon(url) as unknown as ParticipantSql;
  client = sql;
  return sql;
}

/**
 * Crea la billetera del asistente en el primer ingreso y reanuda la existente en los siguientes.
 * La cláusula ON CONFLICT evita duplicados gracias a la restricción única (proveedor_oauth, id_externo).
 */
export async function provisionParticipant(
  sql: ParticipantSql,
  identity: ParticipantIdentity,
): Promise<ParticipantAccount> {
  const rows = await sql`
    insert into usuario (proveedor_oauth, id_externo, correo, nombre)
    values ('google', ${identity.externalId}, ${identity.email}, ${identity.name})
    on conflict (proveedor_oauth, id_externo) do update set estado = 'ACTIVO'
    returning id_usuario, saldo_actual, nombre
  `;
  const row = rows[0];
  if (row === undefined) {
    throw new Error("El aprovisionamiento del inversionista no devolvió filas");
  }
  return {
    userId: Number(row.id_usuario),
    balance: Number(row.saldo_actual),
    name: row.nombre ?? null,
  };
}
