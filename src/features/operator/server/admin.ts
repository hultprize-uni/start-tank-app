import { runCloseEvent } from "@/server/batch/cierre-evento";
import { runRehearsalReset } from "@/server/batch/reinicio-ensayo";
import { sql } from "@/server/db/client";
import { readConfigRows, readEventConfig, writeConfigValue } from "@/server/db/config";
import { queryRounds } from "@/server/db/rounds";
import { normalizeFunctionResult, toNumber } from "@/server/db/values";
import { errorResponse, jsonResponse, readJsonBody, stateResponse } from "@/server/http/responses";
import { buildHealth } from "../health";
import { buildSettings, settingDefinition, validateCriteria, validateSetting } from "../settings";
import { ATTENDEE_ONLINE_SECONDS } from "../thresholds";
import type {
  ConfigView,
  CriterionConfigView,
  JurorConfigView,
  PreflightItem,
  PreflightView,
  StartupConfigView,
} from "../types";
import { referenceRound } from "../view";
import { toAttendeeView, type AttendeeRow } from "./mappers";
import {
  hasActiveRound,
  isConductor,
  logAdminAction,
  queryAttendeeCounts,
  queryJurors,
} from "./queries";
import { readReason, withConductor, withOperator } from "./session";

/*
 * Rutas de administración del evento (RF-09 a RF-11, RF-26 a RF-30). Toda escritura exige el rol
 * CONDUCTOR; el soporte solo lee (RF-05). El cierre y el ensayo ejecutan procesos batch de F7.
 */

/** Máximo de asistentes devueltos por la búsqueda. */
const ATTENDEE_SEARCH_LIMIT = 20;

/* ------------------------------------------------------------------------------------------------
 * Configuración (RF-28, RNF-14)
 * --------------------------------------------------------------------------------------------- */

async function readConfigView(includeCodes: boolean): Promise<ConfigView> {
  const [rows, locked, startups, jurors, criteria] = await Promise.all([
    readConfigRows(),
    hasActiveRound(),
    sql<{
      id: string;
      order: number;
      name: string;
      sdg: string | null;
      description: string | null;
      logo_url: string | null;
    }>`
      select id_startup::text as id, orden_presentacion as "order", nombre as name, ods as sdg,
             descripcion as description, logo_url
        from startup
       order by orden_presentacion`,
    sql<{ id: string; name: string; organization: string | null; code: string }>`
      select id_jurado::text as id, nombre as name, organizacion as organization,
             codigo_acceso as code
        from jurado
       order by id_jurado`,
    sql<{ id: string; name: string; weight: string; anchor_min: string; anchor_max: string }>`
      select id_criterio::text as id, nombre as name, peso::text as weight,
             ancla_min as anchor_min, ancla_max as anchor_max
        from criterio
       order by id_criterio`,
  ]);

  const values: Record<string, number> = {};
  for (const row of rows) {
    const value = Number(row.valor);
    if (settingDefinition(row.clave) !== undefined && Number.isFinite(value)) {
      values[row.clave] = value;
    }
  }

  return {
    locked,
    settings: buildSettings(values),
    startups: startups.map(
      (row): StartupConfigView => ({
        id: row.id,
        order: row.order,
        name: row.name,
        sdg: row.sdg,
        description: row.description,
        logoUrl: row.logo_url,
      }),
    ),
    jurors: jurors.map(
      (row): JurorConfigView => ({
        id: row.id,
        name: row.name,
        organization: row.organization,
        // Los códigos de acceso solo los ve el conductor.
        accessCode: includeCodes ? row.code : null,
      }),
    ),
    criteria: criteria.map(
      (row): CriterionConfigView => ({
        id: row.id,
        name: row.name,
        weight: toNumber(row.weight),
        anchorMin: row.anchor_min,
        anchorMax: row.anchor_max,
      }),
    ),
  };
}

/** GET: parámetros, startups, jurados y criterios. El soporte no recibe los códigos de acceso. */
export function handleOperatorConfigGet(): Promise<Response> {
  return withOperator(async (operatorId) =>
    stateResponse(await readConfigView(await isConductor(operatorId))),
  );
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function requiredText(value: unknown): string | null {
  return optionalText(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

/** Cambia un parámetro numérico. Devuelve la respuesta de error o null si se guardó. */
async function updateSetting(
  operatorId: string,
  body: Record<string, unknown>,
): Promise<Response | null> {
  const key = body.key;
  const value = body.value;
  if (typeof key !== "string" || settingDefinition(key) === undefined) {
    return errorResponse(400, "INVALID_CONFIG_KEY");
  }
  if (typeof value !== "number") return errorResponse(400, "INVALID_CONFIG_VALUE");

  const current: Record<string, number> = {};
  for (const row of await readConfigRows()) current[row.clave] = Number(row.valor);
  const error = validateSetting(key, value, current);
  if (error !== null) return errorResponse(400, error);

  await writeConfigValue(key, String(value));
  await logAdminAction(operatorId, "CONFIGURACION", `${key}: ${current[key] ?? "—"} → ${value}`);
  return null;
}

async function updateStartup(
  operatorId: string,
  body: Record<string, unknown>,
): Promise<Response | null> {
  const name = requiredText(body.name);
  if (!isId(body.id) || name === null) return errorResponse(400, "INVALID_BODY");
  const rows = await sql<{ id: string }>`
    update startup
       set nombre = ${name},
           ods = ${optionalText(body.sdg)},
           descripcion = ${optionalText(body.description)},
           logo_url = ${optionalText(body.logoUrl)}
     where id_startup = ${body.id}::bigint
    returning id_startup::text as id`;
  if (rows.length === 0) return errorResponse(404, "NOT_FOUND");
  await logAdminAction(operatorId, "CONFIGURACION", `Startup ${body.id}: ${name}`);
  return null;
}

async function updateJuror(
  operatorId: string,
  body: Record<string, unknown>,
): Promise<Response | null> {
  const name = requiredText(body.name);
  const code = requiredText(body.accessCode);
  if (!isId(body.id) || name === null || code === null) return errorResponse(400, "INVALID_BODY");
  const [taken] = await sql<{ id: string }>`
    select id_jurado::text as id from jurado
     where codigo_acceso = ${code} and id_jurado <> ${body.id}::bigint`;
  if (taken !== undefined) return errorResponse(409, "CODE_TAKEN");
  const rows = await sql<{ id: string }>`
    update jurado
       set nombre = ${name},
           organizacion = ${optionalText(body.organization)},
           codigo_acceso = ${code}
     where id_jurado = ${body.id}::bigint
    returning id_jurado::text as id`;
  if (rows.length === 0) return errorResponse(404, "NOT_FOUND");
  await logAdminAction(operatorId, "CONFIGURACION", `Jurado ${body.id}: ${name}`);
  return null;
}

/** Actualiza todos los criterios en una sola sentencia, para que los pesos sigan sumando 1. */
async function updateCriteria(
  operatorId: string,
  body: Record<string, unknown>,
): Promise<Response | null> {
  if (!Array.isArray(body.items)) return errorResponse(400, "INVALID_CRITERIA");
  const items: CriterionConfigView[] = [];
  for (const raw of body.items as unknown[]) {
    const item = (raw ?? {}) as Record<string, unknown>;
    if (!isId(item.id) || typeof item.weight !== "number") {
      return errorResponse(400, "INVALID_CRITERIA");
    }
    items.push({
      id: item.id,
      name: String(item.name ?? ""),
      weight: item.weight,
      anchorMin: String(item.anchorMin ?? ""),
      anchorMax: String(item.anchorMax ?? ""),
    });
  }
  const error = validateCriteria(items);
  if (error !== null) return errorResponse(400, error);

  await sql`
    update criterio c
       set nombre = v.nombre, peso = v.peso, ancla_min = v.ancla_min, ancla_max = v.ancla_max
      from unnest(${items.map((i) => i.id)}::bigint[], ${items.map((i) => i.name.trim())}::varchar[],
                  ${items.map((i) => i.weight)}::numeric[], ${items.map((i) => i.anchorMin.trim())}::varchar[],
                  ${items.map((i) => i.anchorMax.trim())}::varchar[])
           as v(id_criterio, nombre, peso, ancla_min, ancla_max)
     where c.id_criterio = v.id_criterio`;
  await logAdminAction(operatorId, "CONFIGURACION", "Criterios del jurado");
  return null;
}

/**
 * POST: cambia la configuración. Cuerpo { kind, ... } (ver ConfigUpdate). Por compatibilidad, un
 * cuerpo { key, value } sin kind es un parámetro. Se rechaza con una ronda en curso (RF-28).
 */
export function handleOperatorConfigPost(request: Request): Promise<Response> {
  return withConductor(async (operatorId) => {
    const body = await readJsonBody(request);
    if (body === null) return errorResponse(400, "INVALID_BODY");
    if (await hasActiveRound()) return errorResponse(409, "ROUND_OPEN");

    const kind = body.kind ?? (typeof body.key === "string" ? "setting" : null);
    let failure: Response | null;
    if (kind === "setting") failure = await updateSetting(operatorId, body);
    else if (kind === "startup") failure = await updateStartup(operatorId, body);
    else if (kind === "juror") failure = await updateJuror(operatorId, body);
    else if (kind === "criteria") failure = await updateCriteria(operatorId, body);
    else failure = errorResponse(400, "INVALID_BODY");

    return failure ?? jsonResponse({ ok: true });
  });
}

/* ------------------------------------------------------------------------------------------------
 * Modo manual (RF-27, RNF-08)
 * --------------------------------------------------------------------------------------------- */

/** POST { enabled: boolean, reason?: string }: activa o desactiva el modo manual y lo registra. */
export function handleOperatorManualMode(request: Request): Promise<Response> {
  return withConductor(async (operatorId) => {
    const body = await readJsonBody(request);
    const enabled = body?.enabled;
    if (typeof enabled !== "boolean") return errorResponse(400, "INVALID_BODY");
    await writeConfigValue("modo_manual", String(enabled));
    await logAdminAction(
      operatorId,
      enabled ? "MODO_MANUAL_ON" : "MODO_MANUAL_OFF",
      readReason(body?.reason),
    );
    return jsonResponse({ ok: true, manualMode: enabled });
  });
}

/* ------------------------------------------------------------------------------------------------
 * Saldos y asistentes (RF-11, RF-26)
 * --------------------------------------------------------------------------------------------- */

/** POST { userId, amount, reason }: ajusta el saldo con motivo obligatorio (RF-11). */
export function handleOperatorBalance(request: Request): Promise<Response> {
  return withConductor(async (operatorId) => {
    const body = await readJsonBody(request);
    const userId = body?.userId;
    const amount = body?.amount;
    const reason = readReason(body?.reason);
    if (!isId(userId) || typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) {
      return errorResponse(400, "INVALID_BODY");
    }
    if (reason === null) return errorResponse(400, "REASON_REQUIRED");
    const [row] = await sql<{ resultado: Record<string, unknown> }>`
      select fn_ajustar_saldo(${operatorId}::bigint, ${userId}::bigint,
                              ${amount}::numeric, ${reason}) as resultado`;
    const result = normalizeFunctionResult(row?.resultado ?? {});
    if (result.ok) return jsonResponse({ ok: true, balance: result.balance ?? null });
    const code = result.error ?? "ADJUSTMENT_REJECTED";
    return errorResponse(code === "FORBIDDEN" ? 403 : 409, code);
  });
}

/**
 * GET ?q=texto: busca asistentes por nombre o correo con su saldo, su posición por patrimonio
 * (saldo más lo invertido en rondas sin liquidar), su última conexión y su última inversión.
 */
export function handleOperatorAttendees(request: Request): Promise<Response> {
  return withOperator(async () => {
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const pattern = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
    const [rows, counts] = await Promise.all([
      sql<AttendeeRow>`
        with patrimonio as (
          select u.id_usuario, u.nombre, u.correo, u.saldo_actual, u.ultima_conexion,
                 u.saldo_actual + coalesce((
                   select sum(i.monto) from inversion i
                    where i.id_usuario = u.id_usuario and i.retorno is null
                 ), 0) as valor
            from usuario u
        ),
        ranked as (
          select p.*, rank() over (order by p.valor desc)::int as posicion from patrimonio p
        )
        select r.id_usuario::text as id,
               r.nombre as name,
               r.correo as email,
               r.saldo_actual::text as balance,
               r.posicion as position,
               extract(epoch from (now() - r.ultima_conexion))::float8 as seconds_since_seen,
               ult.numero as last_round,
               ult.startup as last_startup,
               ult.monto::text as last_amount
          from ranked r
          left join lateral (
            select ro.numero, s.nombre as startup, i.monto
              from inversion i
              join ronda ro on ro.id_ronda = i.id_ronda
              join startup s on s.id_startup = ro.id_startup
             where i.id_usuario = r.id_usuario
             order by ro.numero desc
             limit 1
          ) ult on true
         where r.nombre ilike ${pattern} or r.correo ilike ${pattern}
         order by r.posicion, r.id_usuario
         limit ${ATTENDEE_SEARCH_LIMIT}`,
      queryAttendeeCounts(),
    ]);
    return stateResponse({
      items: rows.map((row) => toAttendeeView(row, ATTENDEE_ONLINE_SECONDS)),
      online: counts.online,
      total: counts.total,
    });
  });
}

/* ------------------------------------------------------------------------------------------------
 * Salud (RF-26, RNF-07)
 * --------------------------------------------------------------------------------------------- */

/** GET: semáforo de base de datos, jurados y teléfonos, con alertas y acción sugerida. */
export function handleOperatorHealth(): Promise<Response> {
  return withOperator(async () => {
    const started = Date.now();
    const rounds = await queryRounds();
    const dbLatencyMs = Date.now() - started;
    const reference = referenceRound(
      rounds.map((row) => ({ number: row.numero, status: row.estado, id: row.id_ronda })),
    );
    const [counts, jurors] = await Promise.all([
      queryAttendeeCounts(),
      reference === undefined ? Promise.resolve([]) : queryJurors(reference.id, false),
    ]);
    return stateResponse(
      buildHealth({
        now: new Date(),
        dbLatencyMs,
        attendeesOnline: counts.online,
        attendeesTotal: counts.total,
        jurors: jurors.map((juror) => ({
          id: juror.id,
          name: juror.name,
          secondsSinceSeen: juror.seconds_since_seen,
          sent: juror.sent,
        })),
        round: reference === undefined ? null : { number: reference.number, status: reference.status },
      }),
    );
  });
}

/* ------------------------------------------------------------------------------------------------
 * Antes del evento (RF-29)
 * --------------------------------------------------------------------------------------------- */

/** Tiempo máximo para comprobar que el login de Neon Auth responde. */
const LOGIN_CHECK_TIMEOUT_MS = 2_000;

/** Comprueba que Neon Auth responde. Cualquier respuesta por debajo de 500 cuenta como viva. */
async function checkLogin(): Promise<PreflightItem> {
  const base = process.env.NEON_AUTH_BASE_URL;
  const item = { id: "login", label: "Login con Google respondiendo" };
  if (!base) return { ...item, ok: false, detail: "Falta NEON_AUTH_BASE_URL en el servidor." };
  const started = Date.now();
  try {
    const response = await fetch(base, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(LOGIN_CHECK_TIMEOUT_MS),
    });
    const ms = Date.now() - started;
    return response.status < 500
      ? { ...item, ok: true, detail: `Neon Auth respondió en ${ms} ms.` }
      : { ...item, ok: false, detail: `Neon Auth respondió con error ${response.status}.` };
  } catch {
    return { ...item, ok: false, detail: "Neon Auth no responde." };
  }
}

async function readPreflight(): Promise<PreflightView> {
  const started = Date.now();
  let row:
    | {
        criterios: number;
        peso_total: string | null;
        startups: number;
        rondas: number;
        programadas: number;
        jurados: number;
        conductores: number;
      }
    | undefined;
  let dbOk = true;
  try {
    [row] = await sql<NonNullable<typeof row>>`
      select (select count(*)::int from criterio) as criterios,
             (select sum(peso)::text from criterio) as peso_total,
             (select count(*)::int from startup) as startups,
             (select count(*)::int from ronda) as rondas,
             (select count(*)::int from ronda where estado = 'PROGRAMADA') as programadas,
             (select count(*)::int from jurado) as jurados,
             (select count(*)::int from operador where rol = 'CONDUCTOR') as conductores`;
  } catch {
    dbOk = false;
  }
  const dbMs = Date.now() - started;
  const [login, { flags }] = await Promise.all([
    checkLogin(),
    dbOk ? readEventConfig() : Promise.resolve({ flags: { eventStarted: false, manualMode: false } }),
  ]);

  const r = row ?? {
    criterios: 0,
    peso_total: null,
    startups: 0,
    rondas: 0,
    programadas: 0,
    jurados: 0,
    conductores: 0,
  };
  const items: PreflightItem[] = [
    {
      id: "startups",
      label: "5 startups cargadas con su ronda",
      detail: `${r.startups} startups y ${r.rondas} rondas.`,
      ok: r.startups === 5 && r.rondas === 5,
    },
    {
      id: "jurors",
      label: "4 jurados con código",
      detail: `${r.jurados} jurados registrados.`,
      ok: r.jurados === 4,
    },
    {
      id: "db",
      label: "Base de datos respondiendo",
      detail: dbOk ? `Respondió en ${dbMs} ms.` : "La consulta falló.",
      ok: dbOk && dbMs < 1_000,
    },
    login,
    {
      id: "criteria",
      label: "4 criterios con pesos que suman 100%",
      detail: `${r.criterios} criterios, suma ${Math.round(Number(r.peso_total ?? 0) * 100)}%.`,
      ok: r.criterios === 4 && Math.abs(Number(r.peso_total ?? 0) - 1) < 0.001,
    },
    {
      id: "rounds",
      label: "Rondas sin abrir",
      detail: `${r.programadas} de ${r.rondas} programadas.`,
      ok: flags.eventStarted || (r.rondas > 0 && r.programadas === r.rondas),
    },
    {
      id: "conductor",
      label: "Al menos un conductor",
      detail: `${r.conductores} conductores.`,
      ok: r.conductores > 0,
    },
  ];
  return { ready: items.every((item) => item.ok), eventStarted: flags.eventStarted, items };
}

/** GET: checklist previo con el estado del evento (RF-29). */
export function handleOperatorPreflight(): Promise<Response> {
  return withOperator(async () => stateResponse(await readPreflight()));
}

/**
 * POST: Iniciar evento. Solo con todo el checklist en verde (RF-29). Desde ese momento el modo
 * ensayo queda bloqueado.
 */
export function handleOperatorStartEvent(): Promise<Response> {
  return withConductor(async (operatorId) => {
    const preflight = await readPreflight();
    if (preflight.eventStarted) return errorResponse(409, "EVENT_ALREADY_STARTED");
    if (!preflight.ready) return errorResponse(409, "PREFLIGHT_NOT_READY");
    await writeConfigValue("evento_iniciado", "true");
    await logAdminAction(operatorId, "INICIAR_EVENTO", null);
    return jsonResponse({ ok: true, eventStarted: true });
  });
}

/* ------------------------------------------------------------------------------------------------
 * Cierre y ensayo (RF-29, RF-30). Los procesos los implementa F7 en server/batch.
 * --------------------------------------------------------------------------------------------- */

/**
 * POST: cierre del evento (proceso batch de F7). Exige todas las rondas liquidadas o anuladas y
 * devuelve EventCloseSummary: ganadora, top 3 y mejor ojo.
 */
export function handleOperatorCloseEvent(): Promise<Response> {
  return withConductor(async (operatorId) => {
    const rounds = await queryRounds();
    const pending = rounds.some((row) => row.estado !== "SETTLED" && row.estado !== "CANCELLED");
    if (rounds.length === 0 || pending) return errorResponse(409, "ROUNDS_PENDING");
    const result = await runCloseEvent(operatorId);
    return result.ok ? jsonResponse(result.summary) : errorResponse(409, result.error);
  });
}

/**
 * POST: reinicio del ensayo (proceso batch de F7), con respaldo previo. Se rechaza con el evento
 * iniciado (RF-29).
 */
export function handleOperatorRehearsal(): Promise<Response> {
  return withConductor(async (operatorId) => {
    const { flags } = await readEventConfig();
    if (flags.eventStarted) return errorResponse(409, "EVENT_STARTED");
    const result = await runRehearsalReset(operatorId);
    return result.ok ? jsonResponse({ ok: true }) : errorResponse(409, result.error);
  });
}
