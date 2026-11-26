import type { EventCloseSummary, PhaseClock } from "@/shared/domain/types";

/**
 * Contrato del view model de la consola del operador (F5).
 * Los componentes presentacionales reciben únicamente estos tipos; el origen de los datos (muestra
 * o API real) queda encapsulado en api/client.ts. Las notas de los jurados nunca viajan antes del
 * veredicto (RF-17, RNF-11).
 */

/** Estados que una ronda recorre en orden. El estado CANCELLED puede alcanzarse desde varios puntos. */
export const ROUND_STATUS_SEQUENCE = [
  "SCHEDULED",
  "PITCH",
  "OPEN",
  "LAST_CALL",
  "CLOSED",
  "VOTING",
  "SETTLED",
] as const;

export type RoundStatus = (typeof ROUND_STATUS_SEQUENCE)[number] | "CANCELLED";

/** Rol del operador (RF-03): el conductor ejecuta acciones y el soporte solo lee. */
export type OperatorRole = "CONDUCTOR" | "SUPPORT";

/** Pasos del ciclo de la ronda, en orden (RF-06). */
export const ROUND_STEPS = ["open", "open_market", "last_call", "close", "enable_voting", "reveal"] as const;

export type OperatorActionId = (typeof ROUND_STEPS)[number];

/** Comandos del cronómetro de la fase (RF-07). */
export type TimerCommand = "pause" | "resume" | "add_minute" | "restart_phase";

/** Modo de anulación: devolver lo invertido al saldo, o liquidar a 1.0x (RF-10). */
export type CancelMode = "refund" | "settle_1x";

/** Paso válido de la ronda, el único que el botón principal ofrece. */
export interface MainActionView {
  id: OperatorActionId;
  label: string;
  enabled: boolean;
  /** Motivo visible cuando el paso está bloqueado. Es null cuando no aplica. */
  blockedReason: string | null;
  /** Ayuda visible junto al botón, por ejemplo "Se cierra sola al llegar a 0:00". */
  hint: string | null;
}

export interface RoundStepView {
  id: OperatorActionId;
  label: string;
  state: "done" | "current" | "pending";
}

/** Estado del envío de un jurado en la ronda (RF-17, RF-26). */
export type JurorStatus = "pending" | "drafting" | "sent" | "abstained";

export interface JurorView {
  id: string;
  name: string;
  status: JurorStatus;
  /** El jurado respondió en los últimos 45 segundos. */
  online: boolean;
  /** Segundos desde su última conexión. Es null si nunca se conectó. */
  lastSeenSeconds: number | null;
  /** Puntaje de 1 a 5. Es null hasta que la ronda se liquida (RNF-11). */
  score: number | null;
}

/** Duración de cada fase de la ronda, en segundos, leída de configuracion. */
export interface PhaseDurations {
  pitch: number;
  qa: number;
  lastCall: number;
  voting: number;
  result: number;
}

/** Adelanto o atraso del evento respecto del horario planeado (tarea 5.3). */
export interface ScheduleView {
  /** Segundos de atraso; negativos cuando el evento va adelantado. Null sin referencia. */
  deltaSeconds: number | null;
  /** Hora ISO planeada para el punto actual de la ronda. */
  plannedAt: string | null;
}

export interface RoundView {
  number: number;
  total: number;
  startupName: string;
  /** Texto del ODS, por ejemplo "ODS 6". */
  sdg: string | null;
  status: RoundStatus;
  /** Multiplicador liquidado. Es null mientras la ronda no esté liquidada. */
  multiplier: number | null;
  /** Puntaje del jurado de 1 a 5. Es null mientras la ronda no esté liquidada. */
  juryScore: number | null;
  cancelMode: CancelMode | null;
}

/** Fila de la lista de rondas del evento, usada en la barra lateral. */
export interface RoundSummaryView {
  number: number;
  startupName: string;
  status: RoundStatus;
  multiplier: number | null;
}

export interface MarketView {
  /** Monto acumulado de la ronda en Impact Coins. */
  accumulated: number;
  uniqueInvestors: number;
  /** Asistentes con conexión en los últimos 30 segundos. */
  connectedAttendees: number;
  /** Billeteras registradas. */
  totalAttendees: number;
  price: number;
}

/** Startup liquidada con su puntaje del jurado. Se ordena de mayor a menor puntaje. */
export interface StandingView {
  roundNumber: number;
  startupName: string;
  juryScore: number;
  multiplier: number | null;
}

export interface LogEntryView {
  id: string;
  /** Hora ISO de la acción. */
  at: string;
  /** Hora en formato HH:MM:SS en la zona del evento. */
  time: string;
  roundNumber: number;
  label: string;
  operator: string;
  /** Motivo escrito por el conductor, cuando corresponde (RF-09). */
  reason: string | null;
}

export interface BalanceRow {
  attendeeId: string;
  attendeeName: string;
  balance: number;
}

export interface PositionRow {
  attendeeId: string;
  attendeeName: string;
  round: number;
  startupName: string;
  amount: number;
  /** Retorno liquidado. Es null mientras la posición no esté liquidada. */
  returnAmount: number | null;
}

export interface OperatorViewModel {
  serverTime: string;
  operator: { name: string; role: OperatorRole };
  event: {
    started: boolean;
    manualMode: boolean;
    /** Último corte liquidado, el que queda vigente en modo manual (RF-27). */
    lastSettledRound: { number: number; startupName: string } | null;
  };
  round: RoundView;
  rounds: RoundSummaryView[];
  /** Paso válido de la ronda. Es null cuando no queda ningún paso (evento por cerrar). */
  mainAction: MainActionView | null;
  steps: RoundStepView[];
  clock: PhaseClock;
  /** Indica si la fase actual admite pausa y +1 min. */
  timerAdjustable: boolean;
  durations: PhaseDurations;
  schedule: ScheduleView;
  jurors: JurorView[];
  market: MarketView;
  standings: StandingView[];
  log: LogEntryView[];
  canCancel: boolean;
  /** Ronda que reinicia «Reiniciar ronda»: la que está en curso o, si no hay, la última terminada. */
  restartRound: { number: number; startupName: string } | null;
  /** Revelar con los jurados presentes: votación con al menos una nota y envíos pendientes. */
  canRescue: boolean;
  canManualSettle: boolean;
  /** Todas las rondas están liquidadas o anuladas: el evento puede cerrarse. */
  canCloseEvent: boolean;
  balances: BalanceRow[];
  positions: PositionRow[];
}

/* Salud del sistema (RF-26, RNF-07) */

export type HealthLevel = "ok" | "warning" | "critical";

export interface HealthSignal {
  id: "db" | "jurors" | "phones";
  label: string;
  value: string;
  level: HealthLevel;
}

/** Acción sugerida de una alerta. */
export type AlertAction = "rescue" | "manual_mode" | "attendees" | "retry";

export interface HealthAlert {
  id: string;
  level: "warning" | "critical";
  title: string;
  detail: string;
  action: AlertAction | null;
}

export interface HealthView {
  serverTime: string;
  signals: HealthSignal[];
  alerts: HealthAlert[];
  dbLatencyMs: number;
  attendeesOnline: number;
  attendeesTotal: number;
}

/* Asistentes (RF-26, HU-17) */

export interface AttendeeView {
  id: string;
  name: string;
  email: string | null;
  balance: number;
  /** Posición por patrimonio entre todos los asistentes. */
  position: number;
  online: boolean;
  lastSeenSeconds: number | null;
  lastInvestment: { roundNumber: number; startupName: string; amount: number } | null;
}

export interface AttendeeSearchView {
  items: AttendeeView[];
  online: number;
  total: number;
}

/* Configuración (RF-28, RNF-14) */

export type SettingUnit = "coins" | "ratio" | "seconds" | "price";

export interface SettingView {
  key: string;
  label: string;
  group: "money" | "durations";
  unit: SettingUnit;
  value: number;
}

export interface StartupConfigView {
  id: string;
  order: number;
  name: string;
  sdg: string | null;
  description: string | null;
  logoUrl: string | null;
}

export interface JurorConfigView {
  id: string;
  name: string;
  organization: string | null;
  /** Código de acceso. El soporte no lo recibe. */
  accessCode: string | null;
}

export interface CriterionConfigView {
  id: string;
  name: string;
  /** Peso entre 0 y 1. Los cuatro suman 1. */
  weight: number;
  anchorMin: string;
  anchorMax: string;
}

export interface ConfigView {
  /** Hay una ronda en curso: la configuración no se puede editar. */
  locked: boolean;
  settings: SettingView[];
  startups: StartupConfigView[];
  jurors: JurorConfigView[];
  criteria: CriterionConfigView[];
}

export type ConfigUpdate =
  | { kind: "setting"; key: string; value: number }
  | {
      kind: "startup";
      id: string;
      name: string;
      sdg: string | null;
      description: string | null;
      logoUrl: string | null;
    }
  | { kind: "juror"; id: string; name: string; organization: string | null; accessCode: string }
  | { kind: "criteria"; items: CriterionConfigView[] };

/* Antes del evento (RF-29) */

export interface PreflightItem {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
}

export interface PreflightView {
  ready: boolean;
  eventStarted: boolean;
  items: PreflightItem[];
}

export type { EventCloseSummary };
