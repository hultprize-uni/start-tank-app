import { getRoundCap } from "@/lib/api/investor.rules";
import type {
  InvestorPhase,
  InvestorViewModel,
  MarketInfo,
  RoundInfo,
  StandingEntry,
  StandingInfo,
  StartupInfo,
  VerdictInfo,
  WalletInfo,
} from "@/lib/api/investor.types";
import { EVENT_CONFIG } from "@/lib/domain/config";
import type { Decision, RoundState } from "@/lib/domain/types";
import { parsearOds } from "./mapeo";
import type { ResultadoFuncion } from "./queries";
import { sql } from "./client";

/*
 * Consultas y constructor del view model del portal del inversionista. Las lecturas arman
 * InvestorViewModel con la misma forma que el hook de simulación. La escritura de inversiones se
 * realiza solo mediante fn_registrar_inversion, que valida las reglas en la transacción.
 */

/** Nombre con el que se presenta la fila propia del inversionista en la clasificación. */
const NOMBRE_PROPIO = "Tú";

/** Estados en los que una ronda ocupa el turno de la sala. */
const ESTADOS_ACTIVOS: ReadonlySet<RoundState> = new Set<RoundState>([
  "ABIERTA",
  "ULTIMA_LLAMADA",
  "CERRADA",
  "EN_VOTACION",
]);

/** Estados terminales de una ronda: liquidada o anulada. */
const ESTADOS_TERMINADOS: ReadonlySet<RoundState> = new Set<RoundState>(["LIQUIDADA", "ANULADA"]);

/** Fila de la ronda con los datos de su startup y de su startup_leaderboard. */
export interface FilaRondaInversionista {
  id_ronda: string;
  numero: number;
  estado: RoundState;
  multiplicador: string | null;
  /** Segundos transcurridos desde la última llamada. Nulo si la ronda nunca la tuvo. */
  segundos_ultima_llamada: number | null;
  startup_nombre: string;
  ods: string | null;
  descripcion: string | null;
  monto_acumulado: string | null;
  inversores_unicos: number | null;
  precio_vivo: string | null;
}

/** Monto invertido y retorno del asistente en una ronda. */
export interface FilaInversionUsuario {
  id_ronda: string;
  monto: string;
  retorno: string;
}

/** Fila del leaderboard de asistentes de una ronda. */
export interface FilaLeaderboardInversionista {
  id_usuario: string;
  nombre: string;
  posicion: number;
  saldo: string;
  aciertos: number;
}

/** Datos necesarios para armar el view model del inversionista. */
export interface DatosEstadoInversionista {
  idUsuario: number;
  saldo: number;
  rondas: readonly FilaRondaInversionista[];
  inversiones: readonly FilaInversionUsuario[];
  /** Votos emitidos en la última ronda terminada. Las abstenciones se incluyen. */
  decisionesUltima: readonly Decision[];
  /** Primeras tres filas del leaderboard de la última ronda terminada. */
  topTres: readonly FilaLeaderboardInversionista[];
  /** Fila del inversionista en el leaderboard de la última ronda terminada. */
  filaPropia: FilaLeaderboardInversionista | null;
  /** Número de filas del leaderboard de la última ronda terminada. */
  participantes: number;
  /** Posición del inversionista en la ronda terminada anterior, si existe. */
  posicionPrevia: number | null;
}

/** Resultado de registrar una inversión. El saldo se devuelve solo en caso de éxito. */
export interface ResultadoInversion {
  ok: boolean;
  error?: string;
  saldo?: number | null;
}

/** Rondas ordenadas por número ascendente sin modificar la lista original. */
function ordenar(rondas: readonly FilaRondaInversionista[]): FilaRondaInversionista[] {
  return [...rondas].sort((a, b) => a.numero - b.numero);
}

/** Rondas terminadas en orden ascendente. La última de la lista es la última terminada. */
function terminadas(rondas: readonly FilaRondaInversionista[]): FilaRondaInversionista[] {
  return ordenar(rondas).filter((r) => ESTADOS_TERMINADOS.has(r.estado));
}

/** Segundos restantes de la última llamada, acotados entre cero y el conteo configurado. */
function segundosRestantes(segundos: number | null): number {
  if (segundos === null) return EVENT_CONFIG.lastCallSeconds;
  const transcurridos = Math.floor(segundos);
  return Math.max(0, EVENT_CONFIG.lastCallSeconds - transcurridos);
}

/** Nombre visible de la startup y de su ODS, por ejemplo "ODS 7 · Energía asequible y no contaminante". */
function construirStartup(fila: FilaRondaInversionista): StartupInfo {
  const ods = parsearOds(fila.ods);
  const etiqueta = ods.numero > 0 ? `ODS ${ods.numero} · ${ods.nombre}` : (fila.ods ?? "");
  return { name: fila.startup_nombre, ods: etiqueta, description: fila.descripcion ?? "" };
}

/**
 * Posición propia: fila del leaderboard de la última ronda terminada. Si la fila falta, se usa la
 * última posición de la tabla como valor de respaldo.
 */
function construirPropia(datos: DatosEstadoInversionista): StandingEntry {
  const posicion = datos.filaPropia?.posicion ?? datos.participantes;
  const saldo = datos.filaPropia ? Number(datos.filaPropia.saldo) : datos.saldo;
  return { position: posicion, name: NOMBRE_PROPIO, balance: saldo, isCurrent: true };
}

/** Clasificación parcial: top 3 de la última ronda terminada y posición propia. */
function construirStanding(datos: DatosEstadoInversionista): StandingInfo {
  const me = construirPropia(datos);
  const topThree: StandingEntry[] = datos.topTres.map((fila) => ({
    position: fila.posicion,
    name: fila.nombre,
    balance: Number(fila.saldo),
    isCurrent: fila.id_usuario === String(datos.idUsuario),
  }));
  const liquidadas = datos.rondas.filter((r) => r.estado === "LIQUIDADA").length;
  return {
    position: me.position,
    previousPosition: datos.posicionPrevia ?? me.position,
    participants: datos.participantes,
    hits: datos.filaPropia?.aciertos ?? 0,
    hitsTotal: liquidadas,
    topThree,
    me,
  };
}

/** Precio y acumulado del mercado de la ronda en curso. El precio base se usa mientras no existe fila. */
function construirMercado(ronda: FilaRondaInversionista): MarketInfo {
  const precio = ronda.precio_vivo === null ? EVENT_CONFIG.priceBase : Number(ronda.precio_vivo);
  return {
    price: precio,
    priceChange: precio - EVENT_CONFIG.priceBase,
    totalRaised: Number(ronda.monto_acumulado ?? 0),
    investorCount: ronda.inversores_unicos ?? 0,
  };
}

/** Veredicto de la ronda terminada: votos del jurado, multiplicador y resultado del asistente. */
function construirVeredicto(
  decisiones: readonly Decision[],
  ronda: FilaRondaInversionista,
  inversion: { monto: number; retorno: number },
): VerdictInfo {
  const backs = decisiones.filter((d) => d === "RESPALDA").length;
  const voters = decisiones.filter((d) => d !== "SE_ABSTIENE").length;
  const multiplier = ronda.multiplicador === null ? 1 : Number(ronda.multiplicador);
  return {
    decisions: [...decisiones],
    backs,
    voters,
    multiplier,
    invested: inversion.monto,
    payout: inversion.retorno,
    gain: inversion.retorno - inversion.monto,
  };
}

/**
 * Arma el view model del inversionista a partir de las filas leídas. La fase se deduce de la ronda
 * activa; si no hay ronda activa, de la última terminada y de la existencia de rondas pendientes.
 * Es una función pura: no accede a la base de datos.
 */
export function construirEstadoInversionista(datos: DatosEstadoInversionista): InvestorViewModel {
  const ordenadas = ordenar(datos.rondas);
  const activa = ordenadas.find((r) => ESTADOS_ACTIVOS.has(r.estado));
  const pendiente = ordenadas.find((r) => r.estado === "PROGRAMADA");
  const ultima = terminadas(datos.rondas).pop();

  let fase: InvestorPhase;
  let referencia: FilaRondaInversionista | undefined;
  if (activa !== undefined) {
    referencia = activa;
    if (activa.estado === "ABIERTA") fase = "open";
    else if (activa.estado === "ULTIMA_LLAMADA") fase = "lastCall";
    else fase = "voting";
  } else if (ultima !== undefined) {
    referencia = ultima;
    fase = pendiente === undefined ? "final" : "result";
  } else {
    referencia = pendiente;
    fase = "scheduled";
  }

  const inversionFila = referencia
    ? datos.inversiones.find((i) => i.id_ronda === referencia?.id_ronda)
    : undefined;
  const inversion = {
    monto: Number(inversionFila?.monto ?? 0),
    retorno: Number(inversionFila?.retorno ?? 0),
  };

  // Saldo al abrir la ronda de referencia: el saldo actual más lo invertido, menos lo recibido por
  // la liquidación. Coincide con la regla de fn_registrar_inversion.
  const saldoApertura = datos.saldo + inversion.monto - inversion.retorno;
  const wallet: WalletInfo = {
    balance: datos.saldo,
    investedInRound: inversion.monto,
    roundCap: getRoundCap(saldoApertura),
  };

  const round: RoundInfo | null = referencia
    ? { number: referencia.numero, total: datos.rondas.length }
    : null;
  const startup: StartupInfo | null = referencia ? construirStartup(referencia) : null;

  const enMercado = fase === "open" || fase === "lastCall";
  const market: MarketInfo | null =
    enMercado && referencia
      ? construirMercado(referencia)
      : null;

  const revelada = fase === "result" || fase === "final";

  return {
    phase: fase,
    round,
    startup,
    wallet,
    market,
    countdownSeconds: fase === "lastCall" ? segundosRestantes(referencia?.segundos_ultima_llamada ?? null) : null,
    verdict:
      revelada && referencia ? construirVeredicto(datos.decisionesUltima, referencia, inversion) : null,
    standing: revelada ? construirStanding(datos) : null,
  };
}

/** Saldo actual del asistente. */
async function consultarSaldo(idUsuario: number): Promise<number> {
  const [fila] = await sql<{ saldo: string }>`
    select saldo_actual::text as saldo
      from usuario
     where id_usuario = ${idUsuario}::bigint`;
  return Number(fila?.saldo ?? 0);
}

/** Todas las rondas con los datos de su startup y de su fila de startup_leaderboard. */
async function consultarRondasInversionista(): Promise<FilaRondaInversionista[]> {
  return sql<FilaRondaInversionista>`
    select r.id_ronda::text as id_ronda,
           r.numero,
           r.estado,
           r.multiplicador::text as multiplicador,
           extract(epoch from (now() - r.ultima_llamada_en))::float8 as segundos_ultima_llamada,
           s.nombre as startup_nombre,
           s.ods,
           s.descripcion,
           sl.monto_acumulado::text as monto_acumulado,
           sl.inversores_unicos,
           sl.precio_vivo::text as precio_vivo
      from ronda r
      join startup s on s.id_startup = r.id_startup
      left join startup_leaderboard sl on sl.id_ronda = r.id_ronda
     order by r.numero`;
}

/** Montos y retornos del asistente agrupados por ronda. */
async function consultarInversionesUsuario(idUsuario: number): Promise<FilaInversionUsuario[]> {
  return sql<FilaInversionUsuario>`
    select i.id_ronda::text as id_ronda,
           sum(i.monto)::text as monto,
           coalesce(sum(i.retorno), 0)::text as retorno
      from inversion i
     where i.id_usuario = ${idUsuario}::bigint
     group by i.id_ronda`;
}

/** Decisiones emitidas por los jurados en una ronda. */
async function consultarDecisiones(idRonda: string): Promise<Decision[]> {
  const filas = await sql<{ decision: Decision }>`
    select v.decision
      from veredicto v
     where v.id_ronda = ${idRonda}::bigint`;
  return filas.map((fila) => fila.decision);
}

/** Primeras tres filas del leaderboard de una ronda. */
async function consultarTopTres(idRonda: string): Promise<FilaLeaderboardInversionista[]> {
  return sql<FilaLeaderboardInversionista>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.posicion,
           l.saldo::text as saldo,
           l.aciertos
      from leaderboard l
      join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${idRonda}::bigint
     order by l.posicion
     limit 3`;
}

/** Fila del asistente en el leaderboard de una ronda, si existe. */
async function consultarFilaLeaderboard(
  idRonda: string,
  idUsuario: number,
): Promise<FilaLeaderboardInversionista | null> {
  const [fila] = await sql<FilaLeaderboardInversionista>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.posicion,
           l.saldo::text as saldo,
           l.aciertos
      from leaderboard l
      join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${idRonda}::bigint
       and l.id_usuario = ${idUsuario}::bigint`;
  return fila ?? null;
}

/** Número de filas del leaderboard de una ronda. */
async function consultarParticipantes(idRonda: string): Promise<number> {
  const [fila] = await sql<{ total: number }>`
    select count(*)::int as total
      from leaderboard
     where id_ronda = ${idRonda}::bigint`;
  return fila?.total ?? 0;
}

/**
 * Lee el view model del inversionista para la sesión indicada. Las consultas del leaderboard se
 * ejecutan solo cuando existe una ronda terminada.
 */
export async function leerEstadoInversionista(idUsuario: number): Promise<InvestorViewModel> {
  const [saldo, rondas, inversiones] = await Promise.all([
    consultarSaldo(idUsuario),
    consultarRondasInversionista(),
    consultarInversionesUsuario(idUsuario),
  ]);

  const terminados = terminadas(rondas);
  const ultima = terminados[terminados.length - 1];
  const previa = terminados[terminados.length - 2];

  let decisionesUltima: Decision[] = [];
  let topTres: FilaLeaderboardInversionista[] = [];
  let filaPropia: FilaLeaderboardInversionista | null = null;
  let participantes = 0;
  if (ultima !== undefined) {
    [decisionesUltima, topTres, filaPropia, participantes] = await Promise.all([
      consultarDecisiones(ultima.id_ronda),
      consultarTopTres(ultima.id_ronda),
      consultarFilaLeaderboard(ultima.id_ronda, idUsuario),
      consultarParticipantes(ultima.id_ronda),
    ]);
  }

  let posicionPrevia: number | null = null;
  if (previa !== undefined) {
    const filaPrevia = await consultarFilaLeaderboard(previa.id_ronda, idUsuario);
    posicionPrevia = filaPrevia?.posicion ?? null;
  }

  return construirEstadoInversionista({
    idUsuario,
    saldo,
    rondas,
    inversiones,
    decisionesUltima,
    topTres,
    filaPropia,
    participantes,
    posicionPrevia,
  });
}

/**
 * Registra una inversión del asistente en la ronda abierta mediante fn_registrar_inversion. El
 * identificador del asistente lo fija el servidor a partir de la sesión, nunca el cuerpo de la
 * petición. Si no hay ronda abierta, devuelve RONDA_NO_ABIERTA sin invocar la función.
 */
export async function registrarInversion(idUsuario: number, monto: number): Promise<ResultadoInversion> {
  const [activa] = await sql<{ id_ronda: string }>`
    select r.id_ronda::text as id_ronda
      from ronda r
     where r.estado in ('ABIERTA', 'ULTIMA_LLAMADA')
     order by r.numero
     limit 1`;
  if (activa === undefined) {
    return { ok: false, error: "RONDA_NO_ABIERTA" };
  }

  const [fila] = await sql<{ resultado: ResultadoFuncion }>`
    select fn_registrar_inversion(${idUsuario}::bigint, ${activa.id_ronda}::bigint, ${monto}::numeric) as resultado`;
  if (fila === undefined) {
    return { ok: false, error: "ERROR_INTERNO" };
  }
  return fila.resultado;
}
