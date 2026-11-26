import type { EventConfig } from "@/shared/domain/config";
import type { PhaseClock } from "@/shared/domain/types";
import { juryFraction } from "@/shared/domain/verdict";
import { priceOf, sortRounds, type RoundRow, type RoundVoteRow } from "@/server/db/rounds";
import { parseSdg, toNumber } from "@/server/db/values";
import type {
  ClosingInfo,
  FeedItem,
  InvestorRow,
  JurySeat,
  ScreenViewModel,
  StagePhase,
  StageStartup,
  StartupResult,
  TickerItem,
} from "../types";

/*
 * Constructor puro del view model del escenario. Recibe las filas que leen las consultas y no
 * accede a la base de datos.
 */

/** Una inversión desde este monto aparece en el feed como apuesta grande. */
const BIG_BET = 2_000;
/** Montos acumulados que se anuncian en el feed al cruzarlos. */
const MILESTONES = [10_000, 25_000, 50_000, 100_000, 200_000];
const FEED_SIZE = 4;

export interface StartupExtra {
  descripcion: string | null;
  logo_url: string | null;
}

export interface RankingRow {
  id_usuario: string;
  nombre: string;
  posicion: number;
  saldo: string;
  aciertos: number;
}

export interface ScreenData {
  now: Date;
  config: EventConfig;
  manualMode: boolean;
  rounds: RoundRow[];
  startups: ReadonlyMap<string, StartupExtra>;
  votes: RoundVoteRow[];
  /** Horas de envío de los jurados en la ronda de referencia. */
  juryTimes: string[];
  investments: { monto: string; creada_en: string }[];
  actions: { accion: string; ejecutada_en: string }[];
  ranking: RankingRow[];
  previousPositions: ReadonlyMap<string, number>;
  attendees: number;
  bestEye: { nombre: string; aciertos: number } | null;
}

const ACTIVE = new Set(["PITCH", "OPEN", "LAST_CALL", "CLOSED", "VOTING"]);
const FINISHED = new Set(["SETTLED", "CANCELLED"]);

/** "Mariana Torres Díaz" queda "Mariana T.". Los nombres de respaldo ("Asistente 12") no cambian. */
export function shortName(full: string): string {
  const [first, second] = full.trim().split(/\s+/);
  if (second === undefined || !/^\p{L}/u.test(second)) return full.trim();
  return `${first} ${second[0].toUpperCase()}.`;
}

function initials(name: string): string {
  const words = name.match(/\p{Lu}/gu) ?? [];
  return (words.length >= 2 ? words.slice(0, 2).join("") : name.slice(0, 2)).toUpperCase();
}

function toStartup(row: RoundRow, extra: StartupExtra | undefined): StageStartup {
  const sdg = parseSdg(row.ods);
  return {
    name: row.startup_nombre,
    sdg: sdg.number > 0 ? `ODS ${sdg.number}: ${sdg.name}` : (row.ods ?? ""),
    description: extra?.descripcion ?? "",
    logoUrl: extra?.logo_url ?? null,
    initials: initials(row.startup_nombre),
  };
}

const formatIc = (value: number) => Math.round(value).toLocaleString("en-US");
const formatX = (value: number) => `${value.toFixed(2).replace(/0$/, "")}x`;

/** Fase y ronda de referencia según el estado de las rondas y la hora del servidor. */
export function resolvePhase(rounds: RoundRow[], now: Date): { phase: StagePhase; reference: RoundRow | undefined } {
  const sorted = sortRounds(rounds);
  const active = sorted.find((r) => ACTIVE.has(r.estado));
  if (active) {
    if (active.estado === "PITCH" || active.estado === "OPEN") return { phase: "MARKET", reference: active };
    if (active.estado === "LAST_CALL") return { phase: "LAST_CALL", reference: active };
    return { phase: "VOTING", reference: active };
  }
  const finished = sorted.filter((r) => FINISHED.has(r.estado));
  const last = finished[finished.length - 1];
  const pending = sorted.find((r) => r.estado === "SCHEDULED");
  if (last === undefined) return { phase: "WAITING", reference: pending };
  const inResult = last.fase_termina_en !== null && Date.parse(last.fase_termina_en) > now.getTime();
  if (inResult) return { phase: "REVEAL", reference: last };
  if (pending === undefined && sorted.some((r) => r.puntaje !== null)) return { phase: "CLOSING", reference: last };
  return { phase: "BETWEEN", reference: last };
}

/** Cronómetro de la fase. El pitch y el toma y dame tienen cada uno su cronómetro. */
function buildClock(row: RoundRow, phase: StagePhase, data: ScreenData): { clock: PhaseClock | null; label: string | null } {
  const serverTime = data.now.toISOString();
  const paused = row.segundos_restantes_pausa !== null;
  const base: PhaseClock = {
    serverTime,
    phaseEndsAt: row.fase_termina_en,
    paused,
    pausedSeconds: row.segundos_restantes_pausa,
  };
  if (phase === "MARKET") return { label: row.estado === "PITCH" ? "Pitch" : "Toma y dame", clock: base };
  if (phase === "LAST_CALL") return { label: "Última llamada", clock: base };
  if (phase === "VOTING" && row.estado === "VOTING") return { label: "Votación", clock: base };
  return { label: null, clock: null };
}

function buildTicker(rounds: RoundRow[], phase: StagePhase): TickerItem[] {
  const sorted = sortRounds(rounds);
  const nextPending = phase === "BETWEEN" || phase === "REVEAL" || phase === "WAITING"
    ? sorted.find((r) => r.estado === "SCHEDULED")
    : undefined;
  return sorted.map((row) => {
    let status: TickerItem["status"] = "pending";
    if (row.estado === "SETTLED") status = "done";
    else if (row.estado === "CANCELLED") status = "cancelled";
    else if (row.estado === "PITCH" || row.estado === "OPEN" || row.estado === "LAST_CALL") status = "live";
    else if (row.estado === "CLOSED" || row.estado === "VOTING") status = "voting";
    else if (row.id_ronda === nextPending?.id_ronda) status = "next";
    return {
      number: row.numero,
      name: row.startup_nombre,
      status,
      multiplier: row.estado === "SETTLED" && row.multiplicador !== null ? toNumber(row.multiplicador) : null,
    };
  });
}

function buildInvestors(data: ScreenData): InvestorRow[] {
  return data.ranking.slice(0, 8).map((row) => ({
    id: row.id_usuario,
    position: row.posicion,
    name: shortName(row.nombre),
    balance: toNumber(row.saldo),
    previousPosition: data.previousPositions.get(row.id_usuario) ?? null,
  }));
}

function buildJury(data: ScreenData, revealed: boolean): JurySeat[] {
  return data.votes.map((vote, index) => ({
    label: `Jurado ${index + 1}`,
    sent: vote.enviado,
    abstained: vote.se_abstiene,
    score: revealed && vote.puntaje !== null ? toNumber(vote.puntaje) : null,
  }));
}

const ACTION_TEXT: Record<string, (name: string) => string> = {
  ABRIR: (name) => `${name} sube al escenario`,
  ABRIR_MERCADO: (name) => `Mercado abierto para ${name}`,
  ULTIMA_LLAMADA: (name) => `Última llamada para ${name}`,
  CERRAR: () => "Mercado cerrado",
  HABILITAR_VOTO: () => "El jurado empieza a calificar",
  PAUSAR: () => "Pausa del conductor",
  REANUDAR: () => "Se reanuda la ronda",
  ANULAR_DEVOLVER: () => "Ronda anulada: se devuelve lo invertido",
  ANULAR_LIQUIDAR_1X: () => "Ronda anulada: se liquida a 1.0x",
};

function buildFeed(data: ScreenData, reference: RoundRow, investors: InvestorRow[]): FeedItem[] {
  const name = reference.startup_nombre;
  const items: FeedItem[] = [];
  let total = 0;
  data.investments.forEach((row, index) => {
    const amount = toNumber(row.monto);
    const before = total;
    total += amount;
    if (amount >= BIG_BET) {
      items.push({ id: `bet-${index}`, text: `Apuesta grande en ${name}: ${formatIc(amount)} IC`, at: row.creada_en, tone: "bet" });
    }
    const crossed = MILESTONES.filter((m) => before < m && total >= m).pop();
    if (crossed !== undefined) {
      items.push({ id: `mil-${crossed}`, text: `${name} supera ${formatIc(crossed)} IC`, at: row.creada_en, tone: "milestone" });
    }
  });
  data.actions.forEach((row, index) => {
    const text = ACTION_TEXT[row.accion];
    if (text) items.push({ id: `act-${index}`, text: text(name), at: row.ejecutada_en, tone: "phase" });
  });
  data.juryTimes.forEach((at, index) => {
    items.push({
      id: `jury-${index}`,
      text: `${index + 1} de ${data.votes.length} jurados enviaron sus notas`,
      at,
      tone: "jury",
    });
  });
  if (reference.estado === "SETTLED" && reference.multiplicador !== null && reference.liquidada_en !== null) {
    items.push({
      id: "verdict",
      text: `Multiplicador de ${name}: ${formatX(toNumber(reference.multiplicador))}`,
      at: reference.liquidada_en,
      tone: "verdict",
    });
    const climber = investors
      .filter((row) => row.previousPosition !== null && row.previousPosition - row.position >= 2)
      .sort((a, b) => b.previousPosition! - b.position - (a.previousPosition! - a.position))[0];
    if (climber) {
      items.push({
        id: "climb",
        text: `${climber.name} sube ${climber.previousPosition! - climber.position} puestos`,
        at: reference.liquidada_en,
        tone: "phase",
      });
    }
  }
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, FEED_SIZE);
}

function buildClosing(data: ScreenData, investors: InvestorRow[]): ClosingInfo | null {
  const scored = data.rounds.filter((r) => r.puntaje !== null);
  if (scored.length === 0) return null;
  const winner = [...scored].sort(
    (a, b) => toNumber(b.puntaje) - toNumber(a.puntaje) || toNumber(b.puntaje_jurado) - toNumber(a.puntaje_jurado),
  )[0];
  return {
    winner: {
      ...toStartup(winner, data.startups.get(winner.id_ronda)),
      multiplier: winner.multiplicador === null ? null : toNumber(winner.multiplicador),
      juryScore: winner.puntaje_jurado === null ? null : toNumber(winner.puntaje_jurado),
      investorShare: data.attendees > 0 ? (winner.inversores_unicos ?? 0) / data.attendees : 0,
      finalScore: toNumber(winner.puntaje),
    },
    top3: investors.slice(0, 3),
    bestEye:
      data.bestEye && data.bestEye.aciertos > 0
        ? { name: shortName(data.bestEye.nombre), hits: data.bestEye.aciertos, rounds: data.rounds.length }
        : null,
  };
}

export function buildScreen(data: ScreenData): ScreenViewModel {
  const { phase, reference } = resolvePhase(data.rounds, data.now);
  const sorted = sortRounds(data.rounds);
  const investors = buildInvestors(data);
  const revealed = reference !== undefined && FINISHED.has(reference.estado);
  const { clock, label } = reference ? buildClock(reference, phase, data) : { clock: null, label: null };

  let total = 0;
  const points = data.investments.map((row) => {
    total += toNumber(row.monto);
    return { at: row.creada_en, total };
  });

  const results: StartupResult[] = sorted
    .filter((r) => FINISHED.has(r.estado))
    .map((r) => ({
      name: r.startup_nombre,
      juryScore: r.puntaje_jurado === null ? null : toNumber(r.puntaje_jurado),
      multiplier: r.multiplicador === null ? null : toNumber(r.multiplicador),
      cancelled: r.estado === "CANCELLED",
    }));

  const pending = sorted.find((r) => r.estado === "SCHEDULED");

  return {
    phase,
    serverTime: data.now.toISOString(),
    manualMode: data.manualMode,
    round: reference ? { number: reference.numero, total: data.rounds.length } : null,
    startup: reference ? toStartup(reference, data.startups.get(reference.id_ronda)) : null,
    clock,
    clockLabel: label,
    market:
      reference && phase !== "WAITING"
        ? {
            accumulated: toNumber(reference.monto_acumulado),
            price: priceOf(reference),
            investors: reference.inversores_unicos ?? 0,
            attendees: data.attendees,
            points,
          }
        : null,
    jury: buildJury(data, revealed),
    verdict:
      reference && revealed
        ? {
            multiplier: toNumber(reference.multiplicador ?? 1),
            juryScore: reference.puntaje_jurado === null ? null : toNumber(reference.puntaje_jurado),
            scorePct: reference.puntaje_jurado === null ? null : Math.round(juryFraction(toNumber(reference.puntaje_jurado)) * 100),
            invested: toNumber(reference.monto_invertido),
            returned: toNumber(reference.retorno_ronda),
            cancelled: reference.estado === "CANCELLED",
            settledAt: reference.liquidada_en,
          }
        : null,
    investors,
    ticker: buildTicker(data.rounds, phase),
    feed: reference ? buildFeed(data, reference, investors) : [],
    results,
    next: phase === "BETWEEN" && pending ? toStartup(pending, data.startups.get(pending.id_ronda)) : null,
    closing: phase === "CLOSING" ? buildClosing(data, investors) : null,
  };
}
