import { sql } from "../db/client.ts";
import { toCsv, writeOutput } from "./io.ts";

/** Saldos y posiciones del último corte (RF-31): UNLOAD de leaderboard y SORT por posición. */
export async function queryLatestPositions() {
  return sql<{ posicion: number; nombre: string; saldo: string; aciertos: number }>`
    select l.posicion,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.saldo::text as saldo,
           l.aciertos
      from leaderboard l
      join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = (
       select r.id_ronda from ronda r
        where r.estado in ('LIQUIDADA', 'ANULADA')
        order by r.numero desc limit 1)
     order by l.posicion`;
}

export async function exportPositions(): Promise<string> {
  return writeOutput("posiciones", "csv", toCsv(await queryLatestPositions()));
}
