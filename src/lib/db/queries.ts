import type { Decision } from "@/lib/domain/types";
import type { JuryViewModel } from "@/lib/api/jury.types";
import type { OperatorViewModel } from "@/lib/api/operator.types";
import type { ScreenViewModel } from "@/lib/api/screen.types";
import { sql } from "./client";
import {
  clasificarRondas,
  construirPantalla,
  construirVistaJurado,
  construirVistaOperador,
  rondaReferenciaOperador,
  rondaReferenciaPantalla,
  type FilaAccion,
  type FilaPosicion,
  type FilaRanking,
  type FilaRonda,
  type FilaSaldo,
  type VotoRonda,
} from "./mapeo";

/*
 * Consultas tipadas de la capa de datos. Cada función de lectura obtiene las filas necesarias y
 * delega el armado del view model en los constructores de mapeo.ts. Las escrituras se realizan
 * solo mediante las funciones SQL transaccionales de la base de datos.
 */

/** Acciones del operador que la API acepta. REVELAR se resuelve con fn_revelar_veredicto. */
export const ACCIONES_OPERADOR = [
  "ABRIR",
  "ULTIMA_LLAMADA",
  "CERRAR",
  "HABILITAR_VOTO",
  "REVELAR",
  "ANULAR_DEVOLVER",
  "ANULAR_LIQUIDAR_1X",
] as const;

export type AccionOperador = (typeof ACCIONES_OPERADOR)[number];

/** Resultado jsonb devuelto por las funciones SQL. */
export interface ResultadoFuncion {
  ok: boolean;
  error?: string;
  [clave: string]: unknown;
}

/** Identidad de un jurado u operador, tal como se almacena en la base de datos. */
export interface Participante {
  id: string;
  nombre: string;
}

/** Límite de filas del leaderboard, dimensionado para hasta 100 asistentes. */
const LIMITE_RANKING = 100;

/** Límite de acciones mostradas en el registro del operador. */
const LIMITE_ACCIONES = 50;

/** Todas las rondas con los datos de su startup y de su fila de startup_leaderboard. */
async function consultarRondas(): Promise<FilaRonda[]> {
  return sql<FilaRonda>`
    select r.id_ronda::text as id_ronda,
           r.numero,
           r.estado,
           r.multiplicador::text as multiplicador,
           extract(epoch from (now() - r.ultima_llamada_en))::float8 as segundos_ultima_llamada,
           s.nombre as startup_nombre,
           s.ods,
           sl.monto_acumulado::text as monto_acumulado,
           sl.inversores_unicos,
           sl.precio_vivo::text as precio_vivo,
           sl.fraccion_respaldo::text as fraccion_respaldo,
           sl.puntaje::text as puntaje,
           (select coalesce(sum(i.monto), 0)::text
              from inversion i
             where i.id_ronda = r.id_ronda) as monto_invertido,
           (select coalesce(sum(i.retorno), 0)::text
              from inversion i
             where i.id_ronda = r.id_ronda) as retorno_ronda
      from ronda r
      join startup s on s.id_startup = r.id_startup
      left join startup_leaderboard sl on sl.id_ronda = r.id_ronda
     order by r.numero`;
}

/** Votos de todos los jurados en una ronda. La decisión es nula para quien aún no votó. */
async function consultarVotosRonda(idRonda: string): Promise<VotoRonda[]> {
  return sql<VotoRonda>`
    select j.id_jurado::text as id_jurado,
           j.nombre,
           v.decision
      from jurado j
      left join veredicto v
        on v.id_jurado = j.id_jurado
       and v.id_ronda = ${idRonda}::bigint
     order by j.id_jurado`;
}

/** Leaderboard de asistentes de una ronda, ordenado por posición. */
async function consultarRanking(idRonda: string): Promise<FilaRanking[]> {
  return sql<FilaRanking>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.posicion,
           l.saldo::text as saldo,
           l.aciertos
      from leaderboard l
      join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${idRonda}::bigint
     order by l.posicion
     limit ${LIMITE_RANKING}`;
}

/** Número de asistentes con cuenta activa. */
async function consultarUsuariosActivos(): Promise<number> {
  const [fila] = await sql<{ total: number }>`
    select count(*)::int as total
      from usuario
     where estado = 'ACTIVO'`;
  return fila?.total ?? 0;
}

/** Número de jurados registrados. */
async function consultarTotalJurados(): Promise<number> {
  const [fila] = await sql<{ total: number }>`select count(*)::int as total from jurado`;
  return fila?.total ?? 0;
}

/** Saldos actuales de todos los asistentes. */
async function consultarSaldos(): Promise<FilaSaldo[]> {
  return sql<FilaSaldo>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           u.saldo_actual::text as saldo_actual
      from usuario u
     order by u.saldo_actual desc, u.id_usuario`;
}

/** Posiciones por asistente y ronda: monto invertido y retorno, si la ronda ya está liquidada. */
async function consultarPosiciones(): Promise<FilaPosicion[]> {
  return sql<FilaPosicion>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           r.numero,
           s.nombre as startup_nombre,
           sum(i.monto)::text as monto,
           case when count(*) filter (where i.retorno is null) = 0
                then sum(i.retorno)::text
           end as retorno
      from inversion i
      join usuario u on u.id_usuario = i.id_usuario
      join ronda r on r.id_ronda = i.id_ronda
      join startup s on s.id_startup = r.id_startup
     group by u.id_usuario, u.nombre, r.numero, s.nombre
     order by r.numero, u.nombre`;
}

/** Última acción de anulación registrada para una ronda, si existe. */
async function consultarAccionAnulacion(idRonda: string): Promise<string | null> {
  const [fila] = await sql<{ accion: string }>`
    select a.accion
      from accion_ronda a
     where a.id_ronda = ${idRonda}::bigint
       and a.accion in ('ANULAR_DEVOLVER', 'ANULAR_LIQUIDAR_1X')
     order by a.id_accion desc
     limit 1`;
  return fila?.accion ?? null;
}

/** Acciones recientes del operador, de la más nueva a la más antigua. */
async function consultarAcciones(): Promise<FilaAccion[]> {
  return sql<FilaAccion>`
    select a.id_accion::text as id_accion,
           a.accion,
           a.ejecutada_en,
           o.nombre as operador,
           r.numero,
           s.nombre as startup_nombre
      from accion_ronda a
      join operador o on o.id_operador = a.id_operador
      join ronda r on r.id_ronda = a.id_ronda
      join startup s on s.id_startup = r.id_startup
     order by a.id_accion desc
     limit ${LIMITE_ACCIONES}`;
}

/** Busca un jurado por su código de acceso. */
export async function buscarJuradoPorCodigo(codigo: string): Promise<Participante | null> {
  const [fila] = await sql<Participante>`
    select id_jurado::text as id, nombre
      from jurado
     where codigo_acceso = ${codigo}
     limit 1`;
  return fila ?? null;
}

/** Busca un operador por su código de acceso. */
export async function buscarOperadorPorCodigo(codigo: string): Promise<Participante | null> {
  const [fila] = await sql<Participante>`
    select id_operador::text as id, nombre
      from operador
     where codigo_acceso = ${codigo}
     limit 1`;
  return fila ?? null;
}

/** Busca un jurado por su identificador de sesión. */
async function buscarJuradoPorId(id: string): Promise<Participante | null> {
  const [fila] = await sql<Participante>`
    select id_jurado::text as id, nombre
      from jurado
     where id_jurado = ${id}::bigint`;
  return fila ?? null;
}

/**
 * Lee el view model de la pantalla pública. Devuelve nulo cuando el evento no tiene rondas.
 * Solo ejecuta consultas de lectura.
 */
export async function leerPantalla(ahora: Date = new Date()): Promise<ScreenViewModel | null> {
  const rondas = await consultarRondas();
  const referencia = rondaReferenciaPantalla(rondas);
  if (referencia === undefined) return null;

  const ultimaTerminada = clasificarRondas(rondas).ultimaTerminada;
  const [votos, ranking, usuariosActivos] = await Promise.all([
    consultarVotosRonda(referencia.id_ronda),
    ultimaTerminada ? consultarRanking(ultimaTerminada.id_ronda) : Promise.resolve([]),
    consultarUsuariosActivos(),
  ]);

  return construirPantalla({ rondas, votos, ranking, usuariosActivos }, ahora);
}

/**
 * Lee el view model del portal del jurado. Devuelve nulo cuando el jurado no existe.
 * Los votos de otros jurados se consultan, pero el view model solo expone conteos.
 */
export async function leerVistaJurado(juradoId: string): Promise<JuryViewModel | null> {
  const jurado = await buscarJuradoPorId(juradoId);
  if (jurado === null) return null;

  const rondas = await consultarRondas();
  const activa = clasificarRondas(rondas).activa;
  const [votos, totalJurados] = await Promise.all([
    activa ? consultarVotosRonda(activa.id_ronda) : Promise.resolve([]),
    consultarTotalJurados(),
  ]);

  return construirVistaJurado({
    juradoId: jurado.id,
    nombre: jurado.nombre,
    rondas,
    votos,
    totalJurados,
  });
}

/** Lee el view model completo de la consola del operador. Devuelve nulo cuando no hay rondas. */
export async function leerVistaOperador(ahora: Date = new Date()): Promise<OperatorViewModel | null> {
  const rondas = await consultarRondas();
  const actual = rondaReferenciaOperador(rondas);
  if (actual === undefined) return null;

  const [votos, accionAnulacion, usuariosActivos, saldos, posiciones, acciones] = await Promise.all([
    consultarVotosRonda(actual.id_ronda),
    consultarAccionAnulacion(actual.id_ronda),
    consultarUsuariosActivos(),
    consultarSaldos(),
    consultarPosiciones(),
    consultarAcciones(),
  ]);

  return construirVistaOperador({
    rondas,
    votos,
    accionAnulacion,
    usuariosActivos,
    saldos,
    posiciones,
    acciones,
    ahora,
  });
}

/**
 * Registra el voto del jurado en la ronda activa mediante fn_registrar_voto. La función valida el
 * estado de la ronda y la unicidad del voto.
 */
export async function registrarVoto(juradoId: string, decision: Decision): Promise<ResultadoFuncion> {
  const rondas = await consultarRondas();
  const activa = clasificarRondas(rondas).activa;
  if (activa === undefined) {
    return { ok: false, error: "RONDA_NO_EN_VOTACION" };
  }

  const [fila] = await sql<{ resultado: ResultadoFuncion }>`
    select fn_registrar_voto(${juradoId}::bigint, ${activa.id_ronda}::bigint, ${decision}::varchar) as resultado`;
  return fila.resultado;
}

/**
 * Ejecuta una acción del operador sobre la ronda que le corresponde. ABRIR actúa sobre la siguiente
 * ronda programada y el resto sobre la ronda activa. REVELAR llama a fn_revelar_veredicto y las
 * demás acciones a fn_accion_operador.
 */
export async function ejecutarAccionOperador(
  operadorId: string,
  accion: AccionOperador,
): Promise<ResultadoFuncion> {
  const rondas = await consultarRondas();
  const c = clasificarRondas(rondas);
  const ronda = accion === "ABRIR" ? c.pendiente : c.activa;
  if (ronda === undefined) {
    return { ok: false, error: "RONDA_NO_DISPONIBLE" };
  }

  if (accion === "REVELAR") {
    const [fila] = await sql<{ resultado: ResultadoFuncion }>`
      select fn_revelar_veredicto(${operadorId}::bigint, ${ronda.id_ronda}::bigint) as resultado`;
    return fila.resultado;
  }

  const [fila] = await sql<{ resultado: ResultadoFuncion }>`
    select fn_accion_operador(${operadorId}::bigint, ${ronda.id_ronda}::bigint, ${accion}::varchar) as resultado`;
  return fila.resultado;
}
