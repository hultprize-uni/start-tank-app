import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
if (!process.env.DATABASE_URL.includes("ep-nameless-wave")) throw new Error("No es la rama de carga");
const [op] = await sql`select id_operador, codigo_acceso from operador where rol = 'CONDUCTOR' order by id_operador limit 1`;
console.log(await sql`select fn_reiniciar_evento(${op.id_operador}::bigint) as r`);
await sql`insert into usuario (proveedor_oauth, id_externo, nombre)
          select 'google', 'load' || g, 'Carga ' || g from generate_series(1, 100) g
          on conflict do nothing`;
console.log((await sql`select count(*)::int as n from usuario`)[0], "codigo:", op.codigo_acceso);
