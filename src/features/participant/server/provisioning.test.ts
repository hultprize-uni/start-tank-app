import { describe, expect, it } from "vitest";
import { type ParticipantRow, type ParticipantSql, provisionParticipant } from "./provisioning";

/**
 * Crea una consulta simulada que reproduce el comportamiento de la tabla usuario:
 * una fila por par (proveedor_oauth, id_externo) y un saldo inicial de 10,000.
 */
function createFakeUserTable() {
  const rows = new Map<string, ParticipantRow & { state: string }>();
  const queries: string[] = [];
  let nextId = 1;

  const sql: ParticipantSql = async (strings, ...params) => {
    queries.push(strings.join("?"));
    const [externalId, , name] = params as [string, string | null, string | null];
    let row = rows.get(externalId);
    if (row === undefined) {
      row = { id_usuario: nextId++, saldo_actual: "10000.00", nombre: name, state: "ACTIVO" };
      rows.set(externalId, row);
    } else {
      row.state = "ACTIVO";
    }
    return [{ id_usuario: row.id_usuario, saldo_actual: row.saldo_actual, nombre: row.nombre }];
  };

  return { sql, rows, queries };
}

const identity = { externalId: "usr_neon_001", email: "asistente@example.com", name: "Ana Pérez" };

describe("provisionParticipant", () => {
  it("crea la billetera de 10,000 en el primer ingreso", async () => {
    const table = createFakeUserTable();

    const account = await provisionParticipant(table.sql, identity);

    expect(account).toEqual({ userId: 1, balance: 10_000, name: "Ana Pérez" });
    expect(table.rows.size).toBe(1);
  });

  it("reanuda la misma billetera en el segundo ingreso sin duplicarla", async () => {
    const table = createFakeUserTable();

    const first = await provisionParticipant(table.sql, identity);
    const second = await provisionParticipant(table.sql, identity);

    expect(second).toEqual(first);
    expect(table.rows.size).toBe(1);
  });

  it("separa las billeteras de cuentas externas distintas", async () => {
    const table = createFakeUserTable();

    const ana = await provisionParticipant(table.sql, identity);
    const luis = await provisionParticipant(table.sql, {
      externalId: "usr_neon_002",
      email: "luis@example.com",
      name: null,
    });

    expect(ana.userId).not.toBe(luis.userId);
    expect(luis.name).toBeNull();
    expect(table.rows.size).toBe(2);
  });

  it("usa la clave de conflicto por proveedor y id externo con proveedor google", async () => {
    const table = createFakeUserTable();

    await provisionParticipant(table.sql, identity);

    expect(table.queries[0]).toContain("on conflict (proveedor_oauth, id_externo)");
    expect(table.queries[0]).toContain("'google'");
  });

  it("falla si la consulta no devuelve filas", async () => {
    const emptySql: ParticipantSql = async () => [];

    await expect(provisionParticipant(emptySql, identity)).rejects.toThrow();
  });
});
