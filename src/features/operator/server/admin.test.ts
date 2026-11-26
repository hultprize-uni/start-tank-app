import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "@/server/auth/code-session";
import { executedSql, setupSql } from "@/server/db/test-support";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/server/db/client", () => ({ sql: sqlMock }));

import {
  handleOperatorBalance,
  handleOperatorConfigGet,
  handleOperatorConfigPost,
  handleOperatorManualMode,
  handleOperatorRehearsal,
  handleOperatorStartEvent,
} from "./admin";

function post(body: unknown): Request {
  return new Request("http://localhost/api/operator/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function signInAs(role: "CONDUCTOR" | "SOPORTE", responses: Record<string, unknown[]> = {}) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === "st_operator" ? { name, value: token } : undefined,
  } as never);
  // Los fragmentos específicos van primero: el checklist también consulta la tabla operador.
  setupSql(sqlMock, { ...responses, "from operador where": [{ nombre: "Diego", rol: role }] });
}

let token = "";

beforeEach(async () => {
  process.env.SESSION_SECRET = "s".repeat(40);
  token = await signSession("operator", "1");
  sqlMock.mockReset();
  vi.mocked(cookies).mockReset();
});

describe("configuración (RF-28)", () => {
  it("rechaza el cambio con una ronda en curso", async () => {
    await signInAs("CONDUCTOR", { "select exists": [{ active: true }] });

    const response = await handleOperatorConfigPost(post({ kind: "setting", key: "tope_ronda", value: 0.25 }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "ROUND_OPEN" });
  });

  it("guarda el tope de 25% con la ronda programada y lo registra en el log", async () => {
    await signInAs("CONDUCTOR", {
      "select exists": [{ active: false }],
      "select clave, valor": [{ clave: "tope_ronda", valor: "0.3" }],
      "insert into configuracion": [],
      "insert into accion_ronda": [],
    });

    const response = await handleOperatorConfigPost(post({ key: "tope_ronda", value: 0.25 }));

    expect(response.status).toBe(200);
    expect(executedSql(sqlMock)).toContain("insert into accion_ronda");
  });

  it("rechaza valores inválidos", async () => {
    await signInAs("CONDUCTOR", {
      "select exists": [{ active: false }],
      "select clave, valor": [],
    });

    const response = await handleOperatorConfigPost(post({ kind: "setting", key: "tope_ronda", value: 2 }));

    expect(response.status).toBe(400);
  });

  it("no deja editar al soporte", async () => {
    await signInAs("SOPORTE");
    const response = await handleOperatorConfigPost(post({ key: "tope_ronda", value: 0.25 }));
    expect(response.status).toBe(403);
  });

  it("no entrega los códigos de los jurados al soporte", async () => {
    await signInAs("SOPORTE", {
      "select clave, valor": [],
      "select exists": [{ active: false }],
      "from startup": [],
      "from jurado": [{ id: "1", name: "Jurado 1", organization: null, code: "JUR-4821" }],
      "from criterio": [],
    });

    const response = await handleOperatorConfigGet();
    const body = (await response.json()) as { jurors: { accessCode: string | null }[] };

    expect(body.jurors[0].accessCode).toBeNull();
  });
});

describe("ajuste de saldo (RF-11)", () => {
  it("exige motivo", async () => {
    await signInAs("CONDUCTOR");
    const response = await handleOperatorBalance(post({ userId: "7", amount: 500, reason: "" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "REASON_REQUIRED" });
  });

  it("devuelve el saldo nuevo", async () => {
    await signInAs("CONDUCTOR", {
      fn_ajustar_saldo: [{ resultado: { ok: true, saldo: "7500.00" } }],
    });
    const response = await handleOperatorBalance(
      post({ userId: "7", amount: 500, reason: "Error del sistema" }),
    );
    await expect(response.json()).resolves.toEqual({ ok: true, balance: 7500 });
  });

  it("rechaza al soporte (HU-17)", async () => {
    await signInAs("SOPORTE");
    const response = await handleOperatorBalance(post({ userId: "7", amount: 500, reason: "x" }));
    expect(response.status).toBe(403);
  });
});

describe("modo manual (RF-27)", () => {
  it("guarda la bandera y deja la acción en el log", async () => {
    await signInAs("CONDUCTOR", { "insert into configuracion": [], "insert into accion_ronda": [] });
    const response = await handleOperatorManualMode(post({ enabled: true }));
    await expect(response.json()).resolves.toEqual({ ok: true, manualMode: true });
    expect(executedSql(sqlMock)).toContain("insert into accion_ronda");
  });
});

describe("antes del evento (RF-29)", () => {
  it("rechaza reiniciar el ensayo con el evento iniciado", async () => {
    await signInAs("CONDUCTOR", {
      "from configuracion": [{ clave: "evento_iniciado", valor: "true" }],
    });
    const response = await handleOperatorRehearsal(new Request("http://test/api/operator/rehearsal", { method: "POST" }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "EVENT_STARTED" });
  });

  it("no inicia el evento si falta un punto del checklist", async () => {
    delete process.env.NEON_AUTH_BASE_URL;
    await signInAs("CONDUCTOR", {
      "(select count(*)::int from criterio)": [
        {
          criterios: 4,
          peso_total: "1.000",
          startups: 4,
          rondas: 4,
          programadas: 4,
          jurados: 4,
          conductores: 1,
        },
      ],
      "from configuracion": [],
    });
    const response = await handleOperatorStartEvent();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "PREFLIGHT_NOT_READY" });
  });
});
