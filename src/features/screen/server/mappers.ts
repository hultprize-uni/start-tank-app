import { EVENT_CONFIG } from "@/shared/domain/config";
import { pickWinner, startupScore, type StartupStanding } from "@/shared/domain/scoring";
import { calcVerdict } from "@/shared/domain/verdict";
import type { Decision } from "@/shared/domain/types";
import {
  accumulatedOf,
  classifyRounds,
  priceOf,
  sortRounds,
  type RoundRow,
  type RoundVoteRow,
} from "@/server/db/rounds";
import { parseSdg, toNumber } from "@/server/db/values";
import type {
  BetweenRounds,
  Closing,
  RevealedVote,
  RoundRef,
  ScreenInvestorRow,
  ScreenStartupRow,
  ScreenViewModel,
  Settlement,
} from "../types";

/*
 * Constructores puros del view model de la pantalla pública. Reciben las filas que devuelven las
 * consultas de queries.ts y no acceden a la base de datos, de modo que el mapeo se prueba sin
 * conexión.
 */

/** Fila del leaderboard de asistentes de una ronda. */
export interface RankingRow {
  id_usuario: string;
  nombre: string;
  posicion: number;
  saldo: string;
  aciertos: number;
}

export interface ScreenData {
  rounds: readonly RoundRow[];
  /** Votos de la ronda de referencia de la pantalla (activa, o la última terminada). */
  votes: readonly RoundVoteRow[];
  /** Leaderboard de la última ronda terminada. */
  ranking: readonly RankingRow[];
  activeUsers: number;
}

/** Ronda que la pantalla proyecta: la activa, o la última terminada, o la siguiente programada. */
export function screenReferenceRound(rounds: readonly RoundRow[]): RoundRow | undefined {
  const c = classifyRounds(rounds);
  return c.active ?? c.lastFinished ?? c.pending ?? sortRounds(rounds)[0];
}

function toRoundRef(row: RoundRow): RoundRef {
  return {
    number: row.numero,
    startup: { name: row.startup_nombre, sdg: parseSdg(row.ods) },
  };
}

function secondsRemaining(row: RoundRow): number {
  if (row.segundos_ultima_llamada === null) return EVENT_CONFIG.lastCallSeconds;
  const elapsed = Math.floor(toNumber(row.segundos_ultima_llamada));
  return Math.max(0, EVENT_CONFIG.lastCallSeconds - elapsed);
}

/** Fila de inversionista a partir del leaderboard de la última ronda terminada. */
function toScreenInvestorRow(row: RankingRow): ScreenInvestorRow {
  return { position: row.posicion, name: row.nombre, balance: toNumber(row.saldo) };
}

/** Lista de startups ordenada por monto accumulated, con su precio vivo. */
function startupRows(rounds: readonly RoundRow[]): ScreenStartupRow[] {
  return sortRounds(rounds)
    .map((r) => ({ row: r, accumulated: accumulatedOf(r) }))
    .sort((a, b) => b.accumulated - a.accumulated || a.row.numero - b.row.numero)
    .map((item, index) => ({
      position: index + 1,
      name: item.row.startup_nombre,
      accumulated: item.accumulated,
      price: priceOf(item.row),
    }));
}

function toRevealedVotes(votes: readonly RoundVoteRow[]): RevealedVote[] {
  return votes
    .filter((v): v is RoundVoteRow & { decision: Decision } => v.decision !== null)
    .map((v) => ({ juror: v.nombre, decision: v.decision }));
}

function buildSettlement(
  last: RoundRow,
  votes: readonly RoundVoteRow[],
  updatedAt: string,
): Settlement {
  const revealedList = toRevealedVotes(votes);
  const backingFraction =
    last.fraccion_respaldo === null
      ? calcVerdict(revealedList.map((v) => v.decision)).fraction
      : toNumber(last.fraccion_respaldo);

  return {
    phase: "SETTLEMENT",
    updatedAt,
    round: toRoundRef(last),
    votes: revealedList,
    backingFraction,
    multiplier: toNumber(last.multiplicador ?? 1),
    amountInvested: toNumber(last.monto_invertido),
    roundReturn: toNumber(last.retorno_ronda),
  };
}

function buildBetweenRounds(
  data: ScreenData,
  closedRound: RoundRow,
  updatedAt: string,
): BetweenRounds {
  return {
    phase: "BETWEEN_ROUNDS",
    updatedAt,
    closedRound: toRoundRef(closedRound),
    investors: data.ranking.map(toScreenInvestorRow),
    startups: startupRows(data.rounds),
  };
}

/**
 * Construye el cierre con la startup ganadora, el top 3 y el asistente con mejor ojo.
 * Devuelve nulo cuando ninguna startup tiene puntaje calculado.
 */
function buildClosing(data: ScreenData, updatedAt: string): Closing | null {
  const candidatas = data.rounds
    .filter((r) => r.fraccion_respaldo !== null && r.puntaje !== null)
    .map((row) => {
      const standing: StartupStanding & { row: RoundRow } = {
        id: row.id_ronda,
        fraction: toNumber(row.fraccion_respaldo),
        investorPct:
          data.activeUsers > 0 ? (row.inversores_unicos ?? 0) / data.activeUsers : 0,
        row,
      };
      return standing;
    });

  const winner = pickWinner(candidatas);
  if (winner === undefined) return null;

  const best = [...data.ranking].sort(
    (a, b) => b.aciertos - a.aciertos || a.posicion - b.posicion,
  )[0];

  return {
    phase: "CLOSING",
    updatedAt,
    winner: {
      name: winner.row.startup_nombre,
      sdg: parseSdg(winner.row.ods),
      score: startupScore(winner.fraction, winner.investorPct),
      backingFraction: winner.fraction,
      investorPercentage: winner.investorPct,
    },
    top3: data.ranking.slice(0, 3).map(toScreenInvestorRow),
    bestEye: best
      ? { name: best.nombre, hits: best.aciertos }
      : { name: "", hits: 0 },
  };
}

/**
 * Construye el view model de la pantalla pública. Devuelve nulo cuando no existen rondas.
 * La fase se deduce del estado de la ronda activa o de la última ronda terminada.
 */
export function buildScreen(data: ScreenData, now: Date): ScreenViewModel | null {
  if (data.rounds.length === 0) return null;

  const updatedAt = now.toISOString();
  const c = classifyRounds(data.rounds);
  const active = c.active;

  if (active !== undefined) {
    const round = toRoundRef(active);
    if (active.estado === "OPEN") {
      return {
        phase: "MARKET",
        updatedAt,
        round,
        price: priceOf(active),
        accumulated: accumulatedOf(active),
        uniqueInvestors: active.inversores_unicos ?? 0,
      };
    }
    if (active.estado === "LAST_CALL") {
      return {
        phase: "LAST_CALL",
        updatedAt,
        round,
        price: priceOf(active),
        accumulated: accumulatedOf(active),
        uniqueInvestors: active.inversores_unicos ?? 0,
        secondsRemaining: secondsRemaining(active),
      };
    }
    return {
      phase: "VOTING",
      updatedAt,
      round,
      votesCast: data.votes.filter((v) => v.decision !== null).length,
      jurorsTotal: data.votes.length,
    };
  }

  const last = c.lastFinished;
  if (last !== undefined) {
    if (c.pending === undefined) {
      const closing = buildClosing(data, updatedAt);
      if (closing !== null) return closing;
    }
    if (last.estado === "SETTLED") {
      return buildSettlement(last, data.votes, updatedAt);
    }
  }

  // Sin rondas terminadas, el evento aún no ha iniciado su primer turno.
  if (last === undefined) {
    const first = c.pending ?? sortRounds(data.rounds)[0];
    return { phase: "WAITING", updatedAt, nextRound: toRoundRef(first) };
  }

  return buildBetweenRounds(data, last, updatedAt);
}
