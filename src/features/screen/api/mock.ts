import type { InvestorRow, ScreenViewModel, StagePhase, StageStartup, TickerItem } from "../types";

/*
 * Datos de muestra del escenario, uno por fase, con los nombres del diseño de Figma. Se usan con
 * NEXT_PUBLIC_USE_MOCKS=true y, en desarrollo, con /screen?phase=REVEAL para revisar cada fase.
 */

export const STAGE_PHASES: StagePhase[] = ["WAITING", "MARKET", "LAST_CALL", "VOTING", "REVEAL", "BETWEEN", "CLOSING"];

const startup = (name: string, sdg: string, description: string): StageStartup => ({
  name,
  sdg,
  description,
  logoUrl: null,
  initials: name.replace(/[^A-Z]/g, "").slice(0, 2) || name.slice(0, 2).toUpperCase(),
});

const AGUA = startup("AguaClara", "ODS 6: Agua limpia y saneamiento", "Filtros comunitarios de agua con seguimiento de calidad en tiempo real.");
const EDU = startup("EduRuta", "ODS 4: Educación de calidad", "Rutas de aprendizaje personalizadas para estudiantes de educación básica.");
const SOL = startup("SolRed", "ODS 7: Energía asequible y no contaminante", "Microrredes solares para comunidades sin acceso estable a la electricidad.");

const NAMES = ["Mariana T.", "Joaquín R.", "Valeria Q.", "Andrea C.", "Renzo A.", "Diego P.", "Lucía H.", "Matías V."];
const BEFORE = [12_480, 11_920, 10_640, 10_210, 10_120, 10_000, 9_880, 9_640];
const AFTER: [string, number, number][] = [
  ["Mariana T.", 14_280, 1], ["Andrea C.", 13_410, 4], ["Diego P.", 12_800, 6], ["Joaquín R.", 12_020, 2],
  ["Valeria Q.", 11_640, 3], ["Renzo A.", 10_980, 5], ["Lucía H.", 10_400, 7], ["Matías V.", 9_940, 8],
];

const investorsBefore: InvestorRow[] = NAMES.map((name, i) => ({
  id: String(i + 1), position: i + 1, name, balance: BEFORE[i], previousPosition: i + 1,
}));
const investorsAfter: InvestorRow[] = AFTER.map(([name, balance, previous], i) => ({
  id: String(NAMES.indexOf(name) + 1), position: i + 1, name, balance, previousPosition: previous,
}));

function ticker(second: TickerItem["status"], third: TickerItem["status"] = "pending"): TickerItem[] {
  return [
    { number: 1, name: "AgroSense", status: "done", multiplier: 1.4 },
    { number: 2, name: "AguaClara", status: second, multiplier: second === "done" ? 1.4 : null },
    { number: 3, name: "EduRuta", status: third, multiplier: null },
    { number: 4, name: "SolRed", status: "pending", multiplier: null },
    { number: 5, name: "SaludCerca", status: "pending", multiplier: null },
  ];
}

/** Curva de muestra: 18 inversiones que suman 56,500 IC. */
function points(now: number) {
  const steps = [1500, 2500, 1800, 3000, 2200, 4000, 2700, 3500, 2400, 4200, 2900, 3600, 3100, 4400, 2800, 3900, 3300, 4700];
  let total = 0;
  return steps.map((amount, i) => {
    total += amount;
    return { at: new Date(now - (steps.length - i) * 20_000).toISOString(), total };
  });
}

const minutes = (now: number, seconds: number) => new Date(now + seconds * 1000).toISOString();

export function mockScreen(phase: StagePhase, now: number = Date.now()): ScreenViewModel {
  const serverTime = new Date(now).toISOString();
  const clock = (seconds: number) => ({ serverTime, phaseEndsAt: minutes(now, seconds), paused: false, pausedSeconds: null });
  const market = { accumulated: 56_500, price: 128.4, investors: 47, attendees: 80, points: points(now) };
  const seats = (sent: boolean[], scores: (number | null)[] = [null, null, null, null]) =>
    sent.map((s, i) => ({ label: `Jurado ${i + 1}`, sent: s, abstained: false, score: scores[i] }));
  const base: ScreenViewModel = {
    phase,
    serverTime,
    manualMode: false,
    round: { number: 2, total: 5 },
    startup: AGUA,
    clock: null,
    clockLabel: null,
    market,
    jury: seats([false, false, false, false]),
    verdict: null,
    investors: investorsBefore,
    ticker: ticker("live"),
    feed: [
      { id: "a", text: "Apuesta grande en AguaClara: 3,000 IC", at: minutes(now, -4), tone: "bet" },
      { id: "b", text: "AguaClara supera 50,000 IC", at: minutes(now, -31), tone: "milestone" },
      { id: "c", text: "Empieza el pitch de AguaClara", at: minutes(now, -60), tone: "phase" },
    ],
    results: [{ name: "AgroSense", juryScore: 4, multiplier: 1.4, cancelled: false }],
    next: null,
    closing: null,
  };

  switch (phase) {
    case "WAITING":
      return { ...base, round: { number: 1, total: 5 }, startup: startup("AgroSense", "ODS 2: Hambre cero", "Monitoreo de cultivos con sensores de bajo costo para pequeños productores."), market: null, investors: [], ticker: ticker("pending").map((t, i) => ({ ...t, status: i === 0 ? "next" : "pending", multiplier: null })), feed: [], results: [] };
    case "MARKET":
      return { ...base, clock: clock(161), clockLabel: "Pitch" };
    case "LAST_CALL":
      return { ...base, clock: clock(42), clockLabel: "Última llamada", market: { ...market, investors: 58 } };
    case "VOTING":
      return { ...base, clock: clock(108), clockLabel: "Votación", market: { ...market, investors: 63 }, jury: seats([true, true, false, true]), ticker: ticker("voting") };
    case "REVEAL":
      return {
        ...base,
        jury: seats([true, true, true, true], [4.25, 4, 3.5, 4.25]),
        verdict: { multiplier: 1.4, juryScore: 4, scorePct: 75, invested: 56_500, returned: 79_100, cancelled: false, settledAt: serverTime },
        investors: investorsAfter,
        ticker: ticker("done"),
        feed: [
          { id: "v", text: "Multiplicador de AguaClara: 1.4x", at: serverTime, tone: "verdict" },
          { id: "c", text: "Diego P. sube 3 puestos", at: serverTime, tone: "phase" },
          { id: "j", text: "4 de 4 jurados enviaron sus notas", at: minutes(now, -20), tone: "jury" },
        ],
      };
    case "BETWEEN":
      return {
        ...base, market: null, investors: investorsAfter, ticker: ticker("done", "next"), next: EDU,
        results: [
          { name: "AgroSense", juryScore: 4, multiplier: 1.4, cancelled: false },
          { name: "AguaClara", juryScore: 4, multiplier: 1.4, cancelled: false },
        ],
      };
    case "CLOSING":
      return {
        ...base, round: { number: 5, total: 5 }, market: null, investors: investorsAfter,
        ticker: [
          { number: 1, name: "AgroSense", status: "done", multiplier: 1.4 },
          { number: 2, name: "AguaClara", status: "done", multiplier: 1.4 },
          { number: 3, name: "EduRuta", status: "done", multiplier: 0.8 },
          { number: 4, name: "SolRed", status: "done", multiplier: 1.6 },
          { number: 5, name: "SaludCerca", status: "done", multiplier: 0.9 },
        ],
        closing: {
          winner: { ...SOL, multiplier: 1.6, juryScore: 4.4, investorShare: 0.78, finalScore: 0.81 },
          top3: [
            { id: "1", position: 1, name: "Mariana T.", balance: 16_940, previousPosition: 1 },
            { id: "2", position: 2, name: "Joaquín R.", balance: 15_210, previousPosition: 2 },
            { id: "3", position: 3, name: "Valeria Q.", balance: 14_380, previousPosition: 3 },
          ],
          bestEye: { name: "Lucía H.", hits: 5, rounds: 5 },
        },
      };
  }
}

export function parsePhase(value: string | undefined): StagePhase | undefined {
  return STAGE_PHASES.find((phase) => phase === value?.toUpperCase());
}
