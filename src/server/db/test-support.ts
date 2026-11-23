import type { Mock } from "vitest";

/*
 * Utilidades de prueba compartidas por las pruebas de consultas. Los datos simulados reproducen los
 * valores de la base de datos (estados como 'ABIERTA'), que la capa de consultas traduce.
 */

/** Respuestas simuladas indexadas por un fragmento del texto SQL de cada consulta. */
export type SqlResponses = Record<string, unknown[]>;

/**
 * Configura el sql simulado: cada consulta devuelve las filas del primer fragmento que aparece en
 * su texto. Una consulta sin fragmento registrado falla para no ocultar consultas inesperadas.
 */
export function setupSql(sqlMock: Mock, responses: SqlResponses): void {
  sqlMock.mockImplementation(async (strings: TemplateStringsArray) => {
    const text = strings.join("?");
    // queryRounds cierra la última llamada vencida antes de leer; no devuelve filas que importen.
    if (text.includes("fn_cerrar_ultima_llamada_vencida")) return [];
    const key = Object.keys(responses).find((fragment) => text.includes(fragment));
    if (key === undefined) {
      throw new Error(`Consulta no mockeada: ${text.trim().slice(0, 80)}`);
    }
    return responses[key];
  });
}

/** Texto de todas las consultas ejecutadas hasta el momento. */
export function executedSql(sqlMock: Mock): string {
  return sqlMock.mock.calls.map(([strings]) => (strings as TemplateStringsArray).join("?")).join("\n");
}

/** Fila de ronda abierta tal como la devuelve la base de datos. */
export const DB_OPEN_ROUND_ROW = {
  id_ronda: "1",
  numero: 1,
  estado: "ABIERTA",
  multiplicador: null,
  segundos_ultima_llamada: null,
  startup_nombre: "AgroSense",
  ods: "ODS 2",
  monto_acumulado: "4000",
  inversores_unicos: 18,
  precio_vivo: "120.00",
  fraccion_respaldo: null,
  puntaje: null,
  monto_invertido: "4000",
  retorno_ronda: "0",
};
