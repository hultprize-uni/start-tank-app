import { describe, expect, it } from "vitest";
import { type InvestorRow, type InvestorSql, provisionInvestor } from "./investor-db";

/**
 * Crea una consulta simulada que reproduce el comportamiento de la tabla usuario:
 * una fila por par (proveedor_oauth, id_externo) y un saldo inicial de 10,000.
 */
function crearTablaUsuarioFalsa() {
  const filas = new Map<string, InvestorRow & { estado: string }>();
  const consultas: string[] = [];
  let siguienteId = 1;

  const sql: InvestorSql = async (strings, ...params) => {
    consultas.push(strings.join("?"));
    const [idExterno, , nombre] = params as [string, string | null, string | null];
    let fila = filas.get(idExterno);
    if (fila === undefined) {
      fila = { id_usuario: siguienteId++, saldo_actual: "10000.00", nombre: nombre, estado: "ACTIVO" };
      filas.set(idExterno, fila);
    } else {
      fila.estado = "ACTIVO";
    }
    return [{ id_usuario: fila.id_usuario, saldo_actual: fila.saldo_actual, nombre: fila.nombre }];
  };

  return { sql, filas, consultas };
}

const identidad = { idExterno: "usr_neon_001", correo: "asistente@example.com", nombre: "Ana Pérez" };

describe("provisionInvestor", () => {
  it("crea la billetera de 10,000 en el primer ingreso", async () => {
    const tabla = crearTablaUsuarioFalsa();

    const cuenta = await provisionInvestor(tabla.sql, identidad);

    expect(cuenta).toEqual({ idUsuario: 1, saldo: 10_000, nombre: "Ana Pérez" });
    expect(tabla.filas.size).toBe(1);
  });

  it("reanuda la misma billetera en el segundo ingreso sin duplicarla", async () => {
    const tabla = crearTablaUsuarioFalsa();

    const primera = await provisionInvestor(tabla.sql, identidad);
    const segunda = await provisionInvestor(tabla.sql, identidad);

    expect(segunda).toEqual(primera);
    expect(tabla.filas.size).toBe(1);
  });

  it("separa las billeteras de cuentas externas distintas", async () => {
    const tabla = crearTablaUsuarioFalsa();

    const ana = await provisionInvestor(tabla.sql, identidad);
    const luis = await provisionInvestor(tabla.sql, {
      idExterno: "usr_neon_002",
      correo: "luis@example.com",
      nombre: null,
    });

    expect(ana.idUsuario).not.toBe(luis.idUsuario);
    expect(luis.nombre).toBeNull();
    expect(tabla.filas.size).toBe(2);
  });

  it("usa la clave de conflicto por proveedor y id externo con proveedor google", async () => {
    const tabla = crearTablaUsuarioFalsa();

    await provisionInvestor(tabla.sql, identidad);

    expect(tabla.consultas[0]).toContain("on conflict (proveedor_oauth, id_externo)");
    expect(tabla.consultas[0]).toContain("'google'");
  });

  it("falla si la consulta no devuelve filas", async () => {
    const sqlVacio: InvestorSql = async () => [];

    await expect(provisionInvestor(sqlVacio, identidad)).rejects.toThrow();
  });
});
