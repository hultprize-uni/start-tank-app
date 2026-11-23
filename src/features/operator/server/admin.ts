import { noSessionResponse, requireOperator } from "@/server/auth/code-session";
import { sql } from "@/server/db/client";
import { EDITABLE_CONFIG_KEYS, readConfigRows, writeConfigValue } from "@/server/db/config";
import { normalizeFunctionResult } from "@/server/db/values";
import { errorResponse, jsonResponse, readJsonBody, stateResponse } from "@/server/http/responses";

/*
 * Rutas de administración del evento creadas en F2 con su contrato (RF-09 a RF-11, RF-25 a RF-29).
 * Ilia (F5) construye la interfaz sobre ellas; Leonel (F7) completa el cierre y el ensayo. Toda
 * escritura exige el rol CONDUCTOR; el soporte solo lee.
 */

/** Un asistente cuenta como conectado si su último latido fue hace menos de 30 segundos. */
const ONLINE_WINDOW = "30 seconds";

/** Ejecuta un handler con la sesión del operador y convierte la falta de sesión en 401. */
async function withOperator(run: (operatorId: string) => Promise<Response>): Promise<Response> {
  try {
    const session = await requireOperator();
    return await run(session.id);
  } catch (error) {
    const noSession = noSessionResponse(error);
    if (noSession !== null) return noSession;
    throw error;
  }
}

async function isConductor(operatorId: string): Promise<boolean> {
  const [row] = await sql<{ rol: string }>`
    select rol from operador where id_operador = ${operatorId}::bigint`;
  return row?.rol === "CONDUCTOR";
}

/** GET: claves de configuracion. POST { key, value }: cambia una clave numérica editable. */
export function handleOperatorConfigGet(): Promise<Response> {
  return withOperator(async () => stateResponse({ items: await readConfigRows() }));
}

export function handleOperatorConfigPost(request: Request): Promise<Response> {
  return withOperator(async (operatorId) => {
    if (!(await isConductor(operatorId))) return errorResponse(403, "FORBIDDEN");
    const body = await readJsonBody(request);
    const key = body?.key;
    const value = body?.value;
    if (typeof key !== "string" || !EDITABLE_CONFIG_KEYS.includes(key)) {
      return errorResponse(400, "INVALID_CONFIG_KEY");
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return errorResponse(400, "INVALID_CONFIG_VALUE");
    }
    await writeConfigValue(key, String(value));
    return jsonResponse({ ok: true });
  });
}

/** POST { enabled: boolean }: activa o desactiva el modo manual (RF-27). */
export function handleOperatorManualMode(request: Request): Promise<Response> {
  return withOperator(async (operatorId) => {
    if (!(await isConductor(operatorId))) return errorResponse(403, "FORBIDDEN");
    const enabled = (await readJsonBody(request))?.enabled;
    if (typeof enabled !== "boolean") return errorResponse(400, "INVALID_BODY");
    await writeConfigValue("modo_manual", String(enabled));
    return jsonResponse({ ok: true, manualMode: enabled });
  });
}

/** POST { userId: string, amount: number, reason: string }: ajusta el saldo (RF-11). */
export function handleOperatorBalance(request: Request): Promise<Response> {
  return withOperator(async (operatorId) => {
    const body = await readJsonBody(request);
    const userId = body?.userId;
    const amount = body?.amount;
    const reason = body?.reason;
    if (
      typeof userId !== "string" ||
      !/^\d+$/.test(userId) ||
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      typeof reason !== "string"
    ) {
      return errorResponse(400, "INVALID_BODY");
    }
    const [row] = await sql<{ resultado: Record<string, unknown> }>`
      select fn_ajustar_saldo(${operatorId}::bigint, ${userId}::bigint,
                              ${amount}::numeric, ${reason}) as resultado`;
    const result = normalizeFunctionResult(row?.resultado ?? {});
    return result.ok
      ? jsonResponse({ ok: true, balance: result.balance ?? null })
      : errorResponse(409, result.error ?? "ADJUSTMENT_REJECTED");
  });
}

/** GET ?q=texto: busca asistentes por nombre o correo, como máximo 20. */
export function handleOperatorAttendees(request: Request): Promise<Response> {
  return withOperator(async () => {
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const pattern = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
    const rows = await sql<{
      id: string;
      name: string | null;
      email: string | null;
      balance: string;
      online: boolean;
    }>`
      select id_usuario::text as id,
             nombre as name,
             correo as email,
             saldo_actual::text as balance,
             coalesce(ultima_conexion > now() - ${ONLINE_WINDOW}::interval, false) as online
        from usuario
       where nombre ilike ${pattern} or correo ilike ${pattern}
       order by nombre nulls last, id_usuario
       limit 20`;
    return stateResponse({
      items: rows.map((row) => ({ ...row, balance: Number(row.balance) })),
    });
  });
}

/** GET: salud del evento: asistentes y jurados conectados y latencia de la base (RF-26). */
export function handleOperatorHealth(): Promise<Response> {
  return withOperator(async () => {
    const started = Date.now();
    const [attendees] = await sql<{ online: number; total: number }>`
      select count(*) filter (where ultima_conexion > now() - ${ONLINE_WINDOW}::interval)::int as online,
             count(*)::int as total
        from usuario`;
    const dbLatencyMs = Date.now() - started;
    const jurors = await sql<{ id: string; name: string; online: boolean }>`
      select id_jurado::text as id,
             nombre as name,
             coalesce(ultima_conexion > now() - ${ONLINE_WINDOW}::interval, false) as online
        from jurado
       order by id_jurado`;
    return stateResponse({
      attendeesOnline: attendees?.online ?? 0,
      attendeesTotal: attendees?.total ?? 0,
      jurors,
      dbLatencyMs,
    });
  });
}

/** GET: checklist previo al evento (RF-25). Cada punto indica si está listo. */
export function handleOperatorPreflight(): Promise<Response> {
  return withOperator(async () => {
    const [row] = await sql<{
      criterios: number;
      peso_total: string | null;
      claves: number;
      startups: number;
      rondas: number;
      programadas: number;
      jurados: number;
      conductores: number;
    }>`
      select (select count(*)::int from criterio) as criterios,
             (select sum(peso)::text from criterio) as peso_total,
             (select count(*)::int from configuracion) as claves,
             (select count(*)::int from startup) as startups,
             (select count(*)::int from ronda) as rondas,
             (select count(*)::int from ronda where estado = 'PROGRAMADA') as programadas,
             (select count(*)::int from jurado) as jurados,
             (select count(*)::int from operador where rol = 'CONDUCTOR') as conductores`;
    const r = row!;
    const items = [
      { id: "criteria", label: "4 criterios con pesos que suman 1", ok: r.criterios === 4 && Number(r.peso_total) === 1 },
      { id: "config", label: "Configuración cargada", ok: r.claves > 0 },
      { id: "startups", label: "5 startups con su ronda", ok: r.startups === 5 && r.rondas === 5 },
      { id: "rounds", label: "Todas las rondas programadas", ok: r.programadas === r.rondas },
      { id: "jurors", label: "4 jurados registrados", ok: r.jurados === 4 },
      { id: "conductor", label: "Al menos un conductor", ok: r.conductores > 0 },
    ];
    return stateResponse({ ready: items.every((item) => item.ok), items });
  });
}

/**
 * POST: cierre del evento y ensayo. Contrato definido en F2; el proceso lo implementa F7 en
 * server/batch. Responden 501 hasta entonces. El cierre devolverá EventCloseSummary.
 */
export function handleOperatorCloseEvent(): Promise<Response> {
  return withOperator(async () => errorResponse(501, "NOT_IMPLEMENTED"));
}

export function handleOperatorRehearsal(): Promise<Response> {
  return withOperator(async () => errorResponse(501, "NOT_IMPLEMENTED"));
}
