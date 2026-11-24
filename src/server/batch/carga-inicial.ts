import { readFile } from "node:fs/promises";
import { sql } from "../db/client.ts";

/*
 * Carga inicial del evento (RF-28): LOAD de configuración, criterios, startups (con su ronda),
 * jurados y operadores desde un archivo JSON (ver db/carga-inicial.example.json). Cada bloque es
 * opcional y la carga es repetible: actualiza lo que ya existe.
 */

export interface InitialLoad {
  configuracion?: Record<string, string | number | boolean>;
  criterios?: { nombre: string; peso: number; ancla_min: string; ancla_max: string }[];
  startups?: { nombre: string; ods: string; orden: number; descripcion: string; logo_url?: string | null }[];
  jurados?: { codigo: string; nombre: string; organizacion?: string | null }[];
  operadores?: { codigo: string; nombre: string; rol: "CONDUCTOR" | "SOPORTE" }[];
}

const json = (value: unknown) => JSON.stringify(value ?? []);

export async function runInitialLoad(data: InitialLoad): Promise<Record<string, number>> {
  const config = Object.entries(data.configuracion ?? {}).map(([clave, valor]) => ({ clave, valor: String(valor) }));

  await sql`
    insert into configuracion (clave, valor)
    select clave, valor from jsonb_to_recordset(${json(config)}::jsonb) as t(clave varchar, valor varchar)
    on conflict (clave) do update set valor = excluded.valor`;
  await sql`
    insert into criterio (nombre, peso, ancla_min, ancla_max)
    select nombre, peso, ancla_min, ancla_max
      from jsonb_to_recordset(${json(data.criterios)}::jsonb)
        as t(nombre varchar, peso numeric, ancla_min varchar, ancla_max varchar)
    on conflict (nombre) do update
      set peso = excluded.peso, ancla_min = excluded.ancla_min, ancla_max = excluded.ancla_max`;
  await sql`
    insert into startup (nombre, ods, orden_presentacion, descripcion, logo_url)
    select nombre, ods, orden, descripcion, logo_url
      from jsonb_to_recordset(${json(data.startups)}::jsonb)
        as t(nombre varchar, ods varchar, orden smallint, descripcion varchar, logo_url varchar)
    on conflict (orden_presentacion) do update
      set nombre = excluded.nombre, ods = excluded.ods,
          descripcion = excluded.descripcion, logo_url = excluded.logo_url`;
  await sql`
    insert into ronda (id_startup, numero)
    select s.id_startup, s.orden_presentacion from startup s
    on conflict do nothing`;
  await sql`
    insert into startup_leaderboard (id_ronda, id_startup)
    select r.id_ronda, r.id_startup from ronda r
    on conflict (id_ronda) do nothing`;
  await sql`
    insert into jurado (codigo_acceso, nombre, organizacion)
    select codigo, nombre, organizacion
      from jsonb_to_recordset(${json(data.jurados)}::jsonb) as t(codigo varchar, nombre varchar, organizacion varchar)
    on conflict (codigo_acceso) do update set nombre = excluded.nombre, organizacion = excluded.organizacion`;
  await sql`
    insert into operador (codigo_acceso, nombre, rol)
    select codigo, nombre, rol
      from jsonb_to_recordset(${json(data.operadores)}::jsonb) as t(codigo varchar, nombre varchar, rol varchar)
    on conflict (codigo_acceso) do update set nombre = excluded.nombre, rol = excluded.rol`;

  return {
    configuracion: config.length,
    criterios: data.criterios?.length ?? 0,
    startups: data.startups?.length ?? 0,
    jurados: data.jurados?.length ?? 0,
    operadores: data.operadores?.length ?? 0,
  };
}

export async function runInitialLoadFromFile(path: string): Promise<Record<string, number>> {
  return runInitialLoad(JSON.parse(await readFile(path, "utf8")) as InitialLoad);
}
