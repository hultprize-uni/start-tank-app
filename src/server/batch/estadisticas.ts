import { sql } from "../db/client.ts";
import { writeOutput } from "./io.ts";

/** Estadísticas del evento: inversión por startup, participación y notas por jurado. */
export async function queryStatistics() {
  const [porStartup, participacion, notas] = await Promise.all([
    sql`
      select r.numero, s.nombre as startup, r.estado,
             coalesce(sl.monto_acumulado, 0)::float8 as monto,
             coalesce(sl.inversores_unicos, 0) as inversores,
             r.multiplicador::float8 as multiplicador,
             sl.puntaje_jurado::float8 as puntaje_jurado,
             sl.puntaje::float8 as puntaje_final
        from ronda r
        join startup s on s.id_startup = r.id_startup
        left join startup_leaderboard sl on sl.id_ronda = r.id_ronda
       order by sl.monto_acumulado desc nulls last`,
    sql`
      select (select count(*)::int from usuario) as asistentes,
             (select count(distinct id_usuario)::int from inversion) as invirtieron,
             (select count(*)::int from inversion) as inversiones,
             (select round(avg(monto), 2)::float8 from inversion) as monto_promedio`,
    sql`
      select j.nombre as jurado, c.nombre as criterio,
             round(avg(n.valor), 2)::float8 as promedio, count(*)::int as notas
        from nota_criterio n
        join veredicto v on v.id_veredicto = n.id_veredicto
        join jurado j on j.id_jurado = v.id_jurado
        join criterio c on c.id_criterio = n.id_criterio
       group by j.nombre, c.nombre, c.id_criterio
       order by j.nombre, c.id_criterio`,
  ]);
  return { porStartup, participacion: participacion[0], notasPorJurado: notas };
}

export async function exportStatistics(): Promise<string> {
  return writeOutput("estadisticas", "json", JSON.stringify(await queryStatistics(), null, 2));
}
