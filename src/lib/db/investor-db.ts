import { neon } from "@neondatabase/serverless";

/** Fila devuelta por la consulta de aprovisionamiento de la tabla usuario. */
export interface InvestorRow {
  id_usuario: number | string;
  saldo_actual: number | string;
  nombre: string | null;
}

/** Función de consulta con plantillas etiquetadas, compatible con el cliente de Neon. */
export type InvestorSql = (
  strings: TemplateStringsArray,
  ...params: unknown[]
) => Promise<InvestorRow[]>;

/** Datos del asistente proporcionados por Neon Auth. */
export interface InvestorIdentity {
  /** Identificador del usuario en Neon Auth. */
  idExterno: string;
  correo: string | null;
  nombre: string | null;
}

/** Billetera del inversionista tal como se expone a la aplicación. */
export interface InvestorAccount {
  idUsuario: number;
  saldo: number;
  nombre: string | null;
}

let client: InvestorSql | undefined;

/** Devuelve el cliente de Neon. Se crea en la primera llamada para no leer DATABASE_URL durante el build. */
export function getInvestorSql(): InvestorSql {
  if (client !== undefined) {
    return client;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Variable de entorno ausente: DATABASE_URL");
  }
  // El tipo de filas del driver es genérico; la forma de InvestorRow se valida en provisionInvestor.
  const sql = neon(url) as unknown as InvestorSql;
  client = sql;
  return sql;
}

/**
 * Crea la billetera del asistente en el primer ingreso y reanuda la existente en los siguientes.
 * La cláusula ON CONFLICT evita duplicados gracias a la restricción única (proveedor_oauth, id_externo).
 */
export async function provisionInvestor(
  sql: InvestorSql,
  identidad: InvestorIdentity,
): Promise<InvestorAccount> {
  const filas = await sql`
    insert into usuario (proveedor_oauth, id_externo, correo, nombre)
    values ('google', ${identidad.idExterno}, ${identidad.correo}, ${identidad.nombre})
    on conflict (proveedor_oauth, id_externo) do update set estado = 'ACTIVO'
    returning id_usuario, saldo_actual, nombre
  `;
  const fila = filas[0];
  if (fila === undefined) {
    throw new Error("El aprovisionamiento del inversionista no devolvió filas");
  }
  return {
    idUsuario: Number(fila.id_usuario),
    saldo: Number(fila.saldo_actual),
    nombre: fila.nombre ?? null,
  };
}
