import { getRoundCap } from "@/features/participant/rules";
import type {
  ParticipantPhase,
  ParticipantViewModel,
  MarketInfo,
  RoundInfo,
  StandingEntry,
  StandingInfo,
  StartupInfo,
  VerdictInfo,
  WalletInfo,
} from "@/features/participant/types";
import { EVENT_CONFIG } from "@/shared/domain/config";
import type { Decision, RoundState } from "@/shared/domain/types";
import { parseSdg } from "../../screen/server/mappers";
import type { SqlFunctionResult } from "../../operator/server/queries";
import { sql } from "../../../server/db/client";

/*
 * Consultas y constructor del view model del portal del inversionista. Las lecturas arman
 * InvestorViewModel con la misma forma que el hook de simulación. La escritura de inversiones se
 * realiza solo mediante fn_registrar_inversion, que valida las reglas en la transacción.
 */

/** Nombre con el que se presenta la fila propia del inversionista en la clasificación. */
const OWN_NAME = "Tú";

/** Estados en los que una ronda ocupa el turno de la sala. */
const ACTIVE_STATES: ReadonlySet<RoundState> = new Set<RoundState>([
  "OPEN",
  "LAST_CALL",
  "CLOSED",
  "VOTING",
]);

/** Estados terminales de una ronda: liquidada o anulada. */
const FINISHED_STATES: ReadonlySet<RoundState> = new Set<RoundState>(["SETTLED", "CANCELLED"]);

/** Fila de la ronda con los datos de su startup y de su startup_leaderboard. */
export interface ParticipantRoundRow {
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
export interface UserInvestmentRow {
  id_ronda: string;
  monto: string;
  retorno: string;
}

/** Fila del leaderboard de asistentes de una ronda. */
export interface ParticipantLeaderboardRow {
  id_usuario: string;
  nombre: string;
  posicion: number;
  saldo: string;
  aciertos: number;
}

/** Datos necesarios para armar el view model del inversionista. */
export interface ParticipantStateData {
  userId: number;
  balance: number;
  rounds: readonly ParticipantRoundRow[];
  investments: readonly UserInvestmentRow[];
  /** Votos emitidos en la última ronda terminada. Las abstenciones se incluyen. */
  lastDecisions: readonly Decision[];
  /** Primeras tres filas del leaderboard de la última ronda terminada. */
  topThreeRows: readonly ParticipantLeaderboardRow[];
  /** Fila del inversionista en el leaderboard de la última ronda terminada. */
  ownRow: ParticipantLeaderboardRow | null;
  /** Número de filas del leaderboard de la última ronda terminada. */
  participants: number;
  /** Posición del inversionista en la ronda terminada anterior, si existe. */
  previousPosition: number | null;
}

/** Resultado de registrar una inversión. El saldo se devuelve solo en caso de éxito. */
export interface InvestmentResult {
  ok: boolean;
  error?: string;
  balance?: number | null;
}

/** Rondas ordenadas por número ascendente sin modificar la lista original. */
function sortRounds(rounds: readonly ParticipantRoundRow[]): ParticipantRoundRow[] {
  return [...rounds].sort((a, b) => a.numero - b.numero);
}

/** Rondas terminadas en orden ascendente. La última de la lista es la última terminada. */
function finished(rounds: readonly ParticipantRoundRow[]): ParticipantRoundRow[] {
  return sortRounds(rounds).filter((r) => FINISHED_STATES.has(r.estado));
}

/** Segundos restantes de la última llamada, acotados entre cero y el conteo configurado. */
function secondsRemaining(seconds: number | null): number {
  if (seconds === null) return EVENT_CONFIG.lastCallSeconds;
  const elapsed = Math.floor(seconds);
  return Math.max(0, EVENT_CONFIG.lastCallSeconds - elapsed);
}

/** Nombre visible de la startup y de su ODS, por ejemplo "ODS 7 · Energía asequible y no contaminante". */
function buildStartupInfo(row: ParticipantRoundRow): StartupInfo {
  const sdg = parseSdg(row.ods);
  const label = sdg.number > 0 ? `ODS ${sdg.number} · ${sdg.name}` : (row.ods ?? "");
  return { name: row.startup_nombre, sdg: label, description: row.descripcion ?? "" };
}

/**
 * Posición propia: fila del leaderboard de la última ronda terminada. Si la fila falta, se usa la
 * última posición de la tabla como valor de respaldo.
 */
function buildOwnEntry(data: ParticipantStateData): StandingEntry {
  const position = data.ownRow?.posicion ?? data.participants;
  const balance = data.ownRow ? Number(data.ownRow.saldo) : data.balance;
  return { position: position, name: OWN_NAME, balance: balance, isCurrent: true };
}

/** Clasificación parcial: top 3 de la última ronda terminada y posición propia. */
function buildStandingInfo(data: ParticipantStateData): StandingInfo {
  const me = buildOwnEntry(data);
  const topThree: StandingEntry[] = data.topThreeRows.map((row) => ({
    position: row.posicion,
    name: row.nombre,
    balance: Number(row.saldo),
    isCurrent: row.id_usuario === String(data.userId),
  }));
  const settledCount = data.rounds.filter((r) => r.estado === "SETTLED").length;
  return {
    position: me.position,
    previousPosition: data.previousPosition ?? me.position,
    participants: data.participants,
    hits: data.ownRow?.aciertos ?? 0,
    hitsTotal: settledCount,
    topThree,
    me,
  };
}

/** Precio y acumulado del mercado de la ronda en curso. El precio base se usa mientras no existe fila. */
function buildMarket(round: ParticipantRoundRow): MarketInfo {
  const price = round.precio_vivo === null ? EVENT_CONFIG.priceBase : Number(round.precio_vivo);
  return {
    price: price,
    priceChange: price - EVENT_CONFIG.priceBase,
    totalRaised: Number(round.monto_acumulado ?? 0),
    investorCount: round.inversores_unicos ?? 0,
  };
}

/** Veredicto de la ronda terminada: votos del jurado, multiplicador y resultado del asistente. */
function buildVerdict(
  decisions: readonly Decision[],
  round: ParticipantRoundRow,
  investment: { amount: number; payout: number },
): VerdictInfo {
  const backs = decisions.filter((d) => d === "BACK").length;
  const voters = decisions.filter((d) => d !== "ABSTAIN").length;
  const multiplier = round.multiplicador === null ? 1 : Number(round.multiplicador);
  return {
    decisions: [...decisions],
    backs,
    voters,
    multiplier,
    invested: investment.amount,
    payout: investment.payout,
    gain: investment.payout - investment.amount,
  };
}

/**
 * Arma el view model del inversionista a partir de las filas leídas. La fase se deduce de la ronda
 * activa; si no hay ronda activa, de la última terminada y de la existencia de rondas pendientes.
 * Es una función pura: no accede a la base de datos.
 */
export function buildParticipantState(data: ParticipantStateData): ParticipantViewModel {
  const sorted = sortRounds(data.rounds);
  const active = sorted.find((r) => ACTIVE_STATES.has(r.estado));
  const pending = sorted.find((r) => r.estado === "SCHEDULED");
  const last = finished(data.rounds).pop();

  let phase: ParticipantPhase;
  let reference: ParticipantRoundRow | undefined;
  if (active !== undefined) {
    reference = active;
    if (active.estado === "OPEN") phase = "open";
    else if (active.estado === "LAST_CALL") phase = "lastCall";
    else phase = "voting";
  } else if (last !== undefined) {
    reference = last;
    phase = pending === undefined ? "final" : "result";
  } else {
    reference = pending;
    phase = "scheduled";
  }

  const investmentRow = reference
    ? data.investments.find((i) => i.id_ronda === reference?.id_ronda)
    : undefined;
  const investment = {
    amount: Number(investmentRow?.monto ?? 0),
    payout: Number(investmentRow?.retorno ?? 0),
  };

  // Saldo al abrir la ronda de referencia: el saldo actual más lo invertido, menos lo recibido por
  // la liquidación. Coincide con la regla de fn_registrar_inversion.
  const openingBalance = data.balance + investment.amount - investment.payout;
  const wallet: WalletInfo = {
    balance: data.balance,
    investedInRound: investment.amount,
    roundCap: getRoundCap(openingBalance),
  };

  const round: RoundInfo | null = reference
    ? { number: reference.numero, total: data.rounds.length }
    : null;
  const startup: StartupInfo | null = reference ? buildStartupInfo(reference) : null;

  const inMarket = phase === "open" || phase === "lastCall";
  const market: MarketInfo | null =
    inMarket && reference
      ? buildMarket(reference)
      : null;

  const revealedRound = phase === "result" || phase === "final";

  return {
    phase: phase,
    round,
    startup,
    wallet,
    market,
    countdownSeconds: phase === "lastCall" ? secondsRemaining(reference?.segundos_ultima_llamada ?? null) : null,
    verdict:
      revealedRound && reference ? buildVerdict(data.lastDecisions, reference, investment) : null,
    standing: revealedRound ? buildStandingInfo(data) : null,
  };
}

/** Saldo actual del asistente. */
async function queryBalance(userId: number): Promise<number> {
  const [row] = await sql<{ saldo: string }>`
    select saldo_actual::text as saldo
      from usuario
     where id_usuario = ${userId}::bigint`;
  return Number(row?.saldo ?? 0);
}

/** Todas las rondas con los datos de su startup y de su fila de startup_leaderboard. */
async function queryParticipantRounds(): Promise<ParticipantRoundRow[]> {
  return sql<ParticipantRoundRow>`
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
async function queryUserInvestments(userId: number): Promise<UserInvestmentRow[]> {
  return sql<UserInvestmentRow>`
    select i.id_ronda::text as id_ronda,
           sum(i.monto)::text as monto,
           coalesce(sum(i.retorno), 0)::text as retorno
      from inversion i
     where i.id_usuario = ${userId}::bigint
     group by i.id_ronda`;
}

/** Decisiones emitidas por los jurados en una ronda. */
async function queryDecisions(roundId: string): Promise<Decision[]> {
  const rows = await sql<{ decision: Decision }>`
    select v.decision
      from veredicto v
     where v.id_ronda = ${roundId}::bigint`;
  return rows.map((row) => row.decision);
}

/** Primeras tres filas del leaderboard de una ronda. */
async function queryTopThree(roundId: string): Promise<ParticipantLeaderboardRow[]> {
  return sql<ParticipantLeaderboardRow>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.posicion,
           l.saldo::text as saldo,
           l.aciertos
      from leaderboard l
      join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${roundId}::bigint
     order by l.posicion
     limit 3`;
}

/** Fila del asistente en el leaderboard de una ronda, si existe. */
async function queryLeaderboardRow(
  roundId: string,
  userId: number,
): Promise<ParticipantLeaderboardRow | null> {
  const [row] = await sql<ParticipantLeaderboardRow>`
    select u.id_usuario::text as id_usuario,
           coalesce(u.nombre, 'Asistente ' || u.id_usuario::text) as nombre,
           l.posicion,
           l.saldo::text as saldo,
           l.aciertos
      from leaderboard l
      join usuario u on u.id_usuario = l.id_usuario
     where l.id_ronda = ${roundId}::bigint
       and l.id_usuario = ${userId}::bigint`;
  return row ?? null;
}

/** Número de filas del leaderboard de una ronda. */
async function queryParticipantCount(roundId: string): Promise<number> {
  const [row] = await sql<{ total: number }>`
    select count(*)::int as total
      from leaderboard
     where id_ronda = ${roundId}::bigint`;
  return row?.total ?? 0;
}

/**
 * Lee el view model del inversionista para la sesión indicada. Las consultas del leaderboard se
 * ejecutan solo cuando existe una ronda terminada.
 */
export async function readParticipantState(userId: number): Promise<ParticipantViewModel> {
  const [balance, rounds, investments] = await Promise.all([
    queryBalance(userId),
    queryParticipantRounds(),
    queryUserInvestments(userId),
  ]);

  const finishedRounds = finished(rounds);
  const last = finishedRounds[finishedRounds.length - 1];
  const previous = finishedRounds[finishedRounds.length - 2];

  let lastDecisions: Decision[] = [];
  let topThreeRows: ParticipantLeaderboardRow[] = [];
  let ownRow: ParticipantLeaderboardRow | null = null;
  let participants = 0;
  if (last !== undefined) {
    [lastDecisions, topThreeRows, ownRow, participants] = await Promise.all([
      queryDecisions(last.id_ronda),
      queryTopThree(last.id_ronda),
      queryLeaderboardRow(last.id_ronda, userId),
      queryParticipantCount(last.id_ronda),
    ]);
  }

  let previousPosition: number | null = null;
  if (previous !== undefined) {
    const previousRow = await queryLeaderboardRow(previous.id_ronda, userId);
    previousPosition = previousRow?.posicion ?? null;
  }

  return buildParticipantState({
    userId: userId,
    balance: balance,
    rounds: rounds,
    investments: investments,
    lastDecisions: lastDecisions,
    topThreeRows: topThreeRows,
    ownRow: ownRow,
    participants: participants,
    previousPosition: previousPosition,
  });
}

/**
 * Registra una inversión del asistente en la ronda abierta mediante fn_registrar_inversion. El
 * identificador del asistente lo fija el servidor a partir de la sesión, nunca el cuerpo de la
 * petición. Si no hay ronda abierta, devuelve RONDA_NO_ABIERTA sin invocar la función.
 */
export async function registerInvestment(userId: number, amount: number): Promise<InvestmentResult> {
  const [active] = await sql<{ id_ronda: string }>`
    select r.id_ronda::text as id_ronda
      from ronda r
     where r.estado in ('ABIERTA', 'ULTIMA_LLAMADA')
     order by r.numero
     limit 1`;
  if (active === undefined) {
    return { ok: false, error: "ROUND_NOT_OPEN" };
  }

  const [row] = await sql<{ resultado: SqlFunctionResult }>`
    select fn_registrar_inversion(${userId}::bigint, ${active.id_ronda}::bigint, ${amount}::numeric) as resultado`;
  if (row === undefined) {
    return { ok: false, error: "INTERNAL_ERROR" };
  }
  return row.resultado;
}
