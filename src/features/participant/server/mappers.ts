import { getRoundCap } from "../rules";
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
import type { Decision, RoundState } from "@/shared/domain/types";
import { parseSdg } from "@/server/db/values";

/*
 * Constructor puro del view model del portal del participante. Arma ParticipantViewModel con la
 * misma forma que el hook de simulación a partir de las filas que devuelven las consultas de
 * queries.ts, sin acceder a la base de datos.
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
  /**
   * Identificadores de las rondas que el operador liquidó a 1.0x. Una ronda liquidada a 1.0x queda
   * en estado LIQUIDADA; esta lista permite distinguirla de una liquidación ordinaria.
   */
  settledAtOneRoundIds: readonly string[];
}

/** Rondas ordenadas por número ascendente sin modificar la lista original. */
function sortRounds(rounds: readonly ParticipantRoundRow[]): ParticipantRoundRow[] {
  return [...rounds].sort((a, b) => a.numero - b.numero);
}

/** Rondas terminadas en orden ascendente. La última de la lista es la última terminada. */
export function finishedRoundsOf(rounds: readonly ParticipantRoundRow[]): ParticipantRoundRow[] {
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

/** Modo de anulación de una ronda terminada. Las rondas anuladas con devolución quedan en CANCELLED. */
function annulmentOf(
  row: ParticipantRoundRow,
  settledAtOne: ReadonlySet<string>,
): AnnulmentMode | null {
  if (!FINISHED_STATES.has(row.estado)) return null;
  if (row.estado === "CANCELLED") return "refund";
  return settledAtOne.has(row.id_ronda) ? "settle-1x" : null;
}

/**
 * Posición propia: fila del leaderboard de la última ronda terminada. Si la fila falta, se usa la
 * última posición de la tabla como valor de respaldo.
 */
function buildOwnEntry(data: ParticipantStateData): StandingEntry {
  const position = data.ownRow?.posicion ?? data.participants;
  const balance = data.ownRow ? Number(data.ownRow.saldo) : data.balance;
  return { position, name: OWN_NAME, balance, isCurrent: true };
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
  const finishedCount = data.rounds.filter((r) => FINISHED_STATES.has(r.estado)).length;
  return {
    position: me.position,
    previousPosition: data.previousPosition ?? me.position,
    participants: data.participants,
    hits: data.ownRow?.aciertos ?? 0,
    hitsTotal: finishedCount,
    topThree,
    me,
  };
}

/** Precio y acumulado del mercado de la ronda en curso. El precio base se usa mientras no existe fila. */
function buildMarket(round: ParticipantRoundRow): MarketInfo {
  const price = round.precio_vivo === null ? EVENT_CONFIG.priceBase : Number(round.precio_vivo);
  return {
    price,
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
  annulment: AnnulmentMode | null,
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
    annulment,
  };
}

/** Estado de una ronda para el riel: la ronda de referencia en curso aparece como actual. */
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

/** Resumen de todas las rondas del evento, con monto invertido, estado y ganancia. */
function buildRoundSummaries(
  data: ParticipantStateData,
  reference: ParticipantRoundRow | undefined,
  investmentsByRound: ReadonlyMap<string, { amount: number; payout: number }>,
  settledAtOne: ReadonlySet<string>,
): RoundSummary[] {
  return sortRounds(data.rounds).map((row) => {
    const investment = investmentsByRound.get(row.id_ronda) ?? { amount: 0, payout: 0 };
    const finished = FINISHED_STATES.has(row.estado);
    return {
      number: row.numero,
      startupName: row.startup_nombre,
      state: trackStateOf(row, reference, settledAtOne),
      invested: investment.amount,
      gain: finished ? investment.payout - investment.amount : null,
    };
  });
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
  const last = finishedRoundsOf(data.rounds).pop();
  const settledAtOne = new Set(data.settledAtOneRoundIds);

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

  const investmentsByRound = new Map(
    data.investments.map((row) => [
      row.id_ronda,
      { amount: Number(row.monto), payout: Number(row.retorno) },
    ]),
  );
  const investment = reference
    ? (investmentsByRound.get(reference.id_ronda) ?? { amount: 0, payout: 0 })
    : { amount: 0, payout: 0 };

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
  const market: MarketInfo | null = inMarket && reference ? buildMarket(reference) : null;

  const revealedRound = phase === "result" || phase === "final";

  return {
    phase,
    round,
    startup,
    wallet,
    market,
    countdownSeconds:
      phase === "lastCall" ? secondsRemaining(reference?.segundos_ultima_llamada ?? null) : null,
    verdict:
      revealedRound && reference
        ? buildVerdict(
            data.lastDecisions,
            reference,
            investment,
            annulmentOf(reference, settledAtOne),
          )
        : null,
    standing: last !== undefined ? buildStandingInfo(data) : null,
    rounds: buildRoundSummaries(data, reference, investmentsByRound, settledAtOne),
  };
}
