import type {
  AnnulmentMode,
  MarketInfo,
  ParticipantPhase,
  ParticipantViewModel,
  RoundInfo,
  RoundSummary,
  RoundTrackState,
  StandingEntry,
  StandingInfo,
  StartupInfo,
  VerdictInfo,
  WalletInfo,
} from "../types";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { roundCap } from "@/shared/domain/investment";
import { isHit } from "@/shared/domain/scoring";
import type { PhaseClock, RoundState } from "@/shared/domain/types";
import { juryFraction } from "@/shared/domain/verdict";
import { parseSdg } from "@/server/db/values";

/*
 * Constructor puro del view model del portal del participante. Arma ParticipantViewModel con la
 * misma forma que el hook de simulación a partir de las filas que devuelven las consultas de
 * queries.ts, sin acceder a la base de datos.
 */

/** Nombre con el que se presenta la fila propia del inversionista en la clasificación. */
const OWN_NAME = "Tú";
const PODIUM_SIZE = 3;

const ACTIVE_STATES: ReadonlySet<RoundState> = new Set<RoundState>([
  "PITCH",
  "OPEN",
  "LAST_CALL",
  "CLOSED",
  "VOTING",
]);
const FINISHED_STATES: ReadonlySet<RoundState> = new Set<RoundState>(["SETTLED", "CANCELLED"]);

/** Fila de la ronda con los datos de su startup y de su startup_leaderboard. */
export interface ParticipantRoundRow {
  id_ronda: string;
  numero: number;
  estado: RoundState;
  multiplicador: string | null;
  /** Hora ISO en que termina la fase actual. */
  fase_termina_en: string | null;
  segundos_restantes_pausa: number | null;
  liquidada_en: string | null;
  startup_nombre: string;
  ods: string | null;
  descripcion: string | null;
  logo_url: string | null;
  monto_acumulado: string | null;
  inversores_unicos: number | null;
  precio_vivo: string | null;
  puntaje_jurado: string | null;
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
  /** Primeras tres filas del leaderboard de la última ronda terminada. */
  topThreeRows: readonly ParticipantLeaderboardRow[];
  /** Filas alrededor del inversionista: hasta 2 por arriba y 2 por abajo, incluida la suya. */
  windowRows: readonly ParticipantLeaderboardRow[];
  /** Fila del inversionista en el leaderboard de la última ronda terminada. */
  ownRow: ParticipantLeaderboardRow | null;
  /** Número de filas del leaderboard de la última ronda terminada. */
  participants: number;
  /** Posición de cada asistente en la ronda terminada anterior, por identificador. */
  previousPositions: ReadonlyMap<string, number>;
  /** Identificadores de las rondas que el operador liquidó a 1.0x. */
  settledAtOneRoundIds: readonly string[];
  /** Startup ganadora del evento, cuando el cierre ya calculó el puntaje final. */
  winnerStartup: string | null;
  /** Hora del servidor en que se arma el estado. */
  now: Date;
}

function sortRounds(rounds: readonly ParticipantRoundRow[]): ParticipantRoundRow[] {
  return [...rounds].sort((a, b) => a.numero - b.numero);
}

/** Rondas terminadas en orden ascendente. La última de la lista es la última terminada. */
export function finishedRoundsOf(rounds: readonly ParticipantRoundRow[]): ParticipantRoundRow[] {
  return sortRounds(rounds).filter((r) => FINISHED_STATES.has(r.estado));
}

/** Nombre visible de la startup y de su ODS, por ejemplo "ODS 7 · Energía asequible y no contaminante". */
function buildStartupInfo(row: ParticipantRoundRow): StartupInfo {
  const sdg = parseSdg(row.ods);
  const label = sdg.number > 0 ? `ODS ${sdg.number} · ${sdg.name}` : (row.ods ?? "");
  return {
    name: row.startup_nombre,
    sdg: label,
    description: row.descripcion ?? "",
    logoUrl: row.logo_url,
  };
}

function annulmentOf(row: ParticipantRoundRow, settledAtOne: ReadonlySet<string>): AnnulmentMode | null {
  if (!FINISHED_STATES.has(row.estado)) return null;
  if (row.estado === "CANCELLED") return "refund";
  return settledAtOne.has(row.id_ronda) ? "settle-1x" : null;
}

function toEntry(
  row: ParticipantLeaderboardRow,
  data: ParticipantStateData,
): StandingEntry {
  const isCurrent = row.id_usuario === String(data.userId);
  return {
    position: row.posicion,
    name: isCurrent ? OWN_NAME : row.nombre,
    balance: Number(row.saldo),
    isCurrent,
    previousPosition: data.previousPositions.get(row.id_usuario) ?? null,
  };
}

/** Aciertos seguidos en las rondas más recientes en que el asistente invirtió. */
function streakOf(
  finished: readonly ParticipantRoundRow[],
  invested: ReadonlyMap<string, { amount: number }>,
  settledAtOne: ReadonlySet<string>,
): number {
  let streak = 0;
  for (const row of [...finished].reverse()) {
    if ((invested.get(row.id_ronda)?.amount ?? 0) === 0) continue;
    const multiplier = Number(row.multiplicador ?? 1);
    if (annulmentOf(row, settledAtOne) !== null || !isHit(multiplier)) break;
    streak += 1;
  }
  return streak;
}

function buildStandingInfo(
  data: ParticipantStateData,
  invested: ReadonlyMap<string, { amount: number }>,
  settledAtOne: ReadonlySet<string>,
): StandingInfo {
  const finished = finishedRoundsOf(data.rounds);
  const own = data.ownRow;
  const me: StandingEntry = own
    ? toEntry(own, data)
    : {
        position: data.participants,
        name: OWN_NAME,
        balance: data.balance,
        isCurrent: true,
        previousPosition: null,
      };
  const topThree = data.topThreeRows.map((row) => toEntry(row, data));
  const leader = topThree[0]?.balance ?? me.balance;
  const podiumLast = topThree[PODIUM_SIZE - 1]?.balance ?? 0;

  return {
    position: me.position,
    previousPosition: me.previousPosition ?? me.position,
    participants: data.participants,
    hits: own?.aciertos ?? 0,
    hitsTotal: finished.length,
    streak: streakOf(finished, invested, settledAtOne),
    topThree,
    window: data.windowRows.map((row) => toEntry(row, data)),
    distanceToFirst: Math.max(0, leader - me.balance),
    distanceToPodium: me.position <= PODIUM_SIZE ? 0 : Math.max(0, podiumLast - me.balance),
    me,
  };
}

function buildMarket(round: ParticipantRoundRow): MarketInfo {
  const price = round.precio_vivo === null ? EVENT_CONFIG.priceBase : Number(round.precio_vivo);
  return {
    price,
    priceChange: price - EVENT_CONFIG.priceBase,
    totalRaised: Number(round.monto_acumulado ?? 0),
    investorCount: round.inversores_unicos ?? 0,
  };
}

function buildClock(round: ParticipantRoundRow, now: Date): PhaseClock {
  return {
    serverTime: now.toISOString(),
    phaseEndsAt: round.fase_termina_en,
    paused: round.segundos_restantes_pausa !== null,
    pausedSeconds: round.segundos_restantes_pausa,
  };
}

function buildVerdict(
  round: ParticipantRoundRow,
  investment: { amount: number; payout: number },
  annulment: AnnulmentMode | null,
): VerdictInfo {
  const score = round.puntaje_jurado === null || annulment !== null ? null : Number(round.puntaje_jurado);
  return {
    juryScore: score,
    scorePct: score === null ? null : Math.round(juryFraction(score) * 100),
    multiplier: round.multiplicador === null ? 1 : Number(round.multiplicador),
    invested: investment.amount,
    payout: investment.payout,
    gain: investment.payout - investment.amount,
    annulment,
    settledAt: round.liquidada_en,
  };
}

function trackStateOf(
  row: ParticipantRoundRow,
  reference: ParticipantRoundRow | undefined,
  settledAtOne: ReadonlySet<string>,
): RoundTrackState {
  if (FINISHED_STATES.has(row.estado)) {
    return annulmentOf(row, settledAtOne) !== null ? "annulled" : "settled";
  }
  return reference?.id_ronda === row.id_ronda ? "current" : "pending";
}

function buildRoundSummaries(
  data: ParticipantStateData,
  reference: ParticipantRoundRow | undefined,
  investmentsByRound: ReadonlyMap<string, { amount: number; payout: number }>,
  settledAtOne: ReadonlySet<string>,
): RoundSummary[] {
  return sortRounds(data.rounds).map((row) => {
    const investment = investmentsByRound.get(row.id_ronda) ?? { amount: 0, payout: 0 };
    return {
      number: row.numero,
      startupName: row.startup_nombre,
      state: trackStateOf(row, reference, settledAtOne),
      invested: investment.amount,
      gain: FINISHED_STATES.has(row.estado) ? investment.payout - investment.amount : null,
    };
  });
}

/**
 * Arma el view model del inversionista. La fase se deduce de la ronda activa; si no hay ronda
 * activa, de la última terminada y de la existencia de rondas pendientes. Es una función pura.
 */
export function buildParticipantState(data: ParticipantStateData): ParticipantViewModel {
  const sorted = sortRounds(data.rounds);
  const active = sorted.find((r) => ACTIVE_STATES.has(r.estado));
  const pending = sorted.find((r) => r.estado === "SCHEDULED");
  const last = finishedRoundsOf(data.rounds).pop();
  const settledAtOne = new Set(data.settledAtOneRoundIds);

  let phase: ParticipantPhase;
  let reference: ParticipantRoundRow | undefined;
  if (active !== undefined) {
    reference = active;
    if (active.estado === "PITCH") phase = "pitch";
    else if (active.estado === "OPEN") phase = "open";
    else if (active.estado === "LAST_CALL") phase = "lastCall";
    else phase = "voting";
  } else if (last !== undefined) {
    reference = last;
    phase = pending === undefined ? "final" : "result";
  } else {
    reference = pending;
    phase = "scheduled";
  }

  const investmentsByRound = new Map(
    data.investments.map((row) => [
      row.id_ronda,
      { amount: Number(row.monto), payout: Number(row.retorno) },
    ]),
  );
  const investment = reference
    ? (investmentsByRound.get(reference.id_ronda) ?? { amount: 0, payout: 0 })
    : { amount: 0, payout: 0 };

  // Saldo con que entró a la ronda: el actual más lo invertido, menos lo recibido al liquidar.
  const openingBalance = data.balance + investment.amount - investment.payout;
  const inRound = phase === "open" || phase === "lastCall" || phase === "voting";
  const wallet: WalletInfo = {
    balance: data.balance,
    investedInRound: investment.amount,
    roundCap: roundCap(openingBalance),
    alreadyInvested: inRound && investment.amount > 0,
  };

  const round: RoundInfo | null = reference ? { number: reference.numero, total: data.rounds.length } : null;
  const inMarket = phase === "open" || phase === "lastCall";
  const revealed = phase === "result" || phase === "final";

  return {
    phase,
    round,
    startup: reference ? buildStartupInfo(reference) : null,
    wallet,
    market: inMarket && reference ? buildMarket(reference) : null,
    clock: reference && active !== undefined ? buildClock(reference, data.now) : null,
    verdict:
      revealed && reference
        ? buildVerdict(reference, investment, annulmentOf(reference, settledAtOne))
        : null,
    standing: last !== undefined ? buildStandingInfo(data, investmentsByRound, settledAtOne) : null,
    rounds: buildRoundSummaries(data, reference, investmentsByRound, settledAtOne),
    winnerStartup: data.winnerStartup,
  };
}
