import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
console.log(await sql`select (select count(*) from usuario)::int as usuarios, (select count(*) from inversion)::int as inversiones,
  (select string_agg(numero || ':' || estado, ', ' order by numero) from ronda) as rondas, (select count(*) from jurado)::int as jurados,
  exists (select 1 from pg_constraint where conname = 'ronda_estado_check' and pg_get_constraintdef(oid) like '%PITCH%') as migracion_pitch,
  (select valor from configuracion where clave = 'evento_iniciado') as evento_iniciado`);
