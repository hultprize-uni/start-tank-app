import {
  CONSOLE_STALE_SECONDS,
  DB_LATENCY_CRITICAL_MS,
  DB_LATENCY_WARNING_MS,
  JUROR_ONLINE_SECONDS,
  MANUAL_MODE_SUGGESTION_SECONDS,
  PHONES_WARNING_RATIO,
} from "./thresholds";
import type { HealthAlert, HealthLevel, HealthSignal, HealthView, RoundStatus } from "./types";

/*
 * Semáforo y alertas de salud (RF-26, RNF-07). Funciones puras: el servidor (operator/health) y
 * los datos de muestra arman el mismo HealthView; la consola agrega la alerta de conexión perdida,
 * que solo el navegador puede detectar.
 */

export interface HealthInput {
  now: Date;
  dbLatencyMs: number;
  attendeesOnline: number;
  attendeesTotal: number;
  /** Jurados con sus segundos desde la última conexión y si ya enviaron en la ronda en curso. */
  jurors: readonly { id: string; name: string; secondsSinceSeen: number | null; sent: boolean }[];
  /** Ronda en curso o de referencia. Null si el evento no tiene rondas. */
  round: { number: number; status: RoundStatus } | null;
}

function dbLevel(latencyMs: number): HealthLevel {
  if (latencyMs >= DB_LATENCY_CRITICAL_MS) return "critical";
  if (latencyMs >= DB_LATENCY_WARNING_MS) return "warning";
  return "ok";
}

function isOffline(secondsSinceSeen: number | null): boolean {
  return secondsSinceSeen === null || secondsSinceSeen >= JUROR_ONLINE_SECONDS;
}

/** Arma las señales del semáforo y las alertas con su acción sugerida. */
export function buildHealth(input: HealthInput): HealthView {
  const alerts: HealthAlert[] = [];
  const status = input.round?.status ?? null;
  const voting = status === "VOTING";
  const marketOpen = status === "OPEN" || status === "LAST_CALL";

  // Base de datos.
  const db = dbLevel(input.dbLatencyMs);
  if (db !== "ok") {
    alerts.push({
      id: `db-${db}`,
      level: db,
      title: `Base de datos lenta: ${(input.dbLatencyMs / 1000).toFixed(1)} s por consulta`,
      detail:
        db === "critical"
          ? "Los teléfonos verán el precio con retraso. Si no mejora en 90 s, activa el modo manual."
          : "Las consultas superan 0.5 s. Revisa la red del auditorio.",
      action: db === "critical" ? "manual_mode" : null,
    });
  }

  // Jurados.
  const offlineJurors = input.jurors.filter((juror) => isOffline(juror.secondsSinceSeen));
  const jurorsOnline = input.jurors.length - offlineJurors.length;
  for (const juror of offlineJurors) {
    // Solo importa durante la votación y si el jurado aún no envió.
    if (!voting || juror.sent) continue;
    const since =
      juror.secondsSinceSeen === null
        ? "no se ha conectado"
        : `desconectado hace ${Math.floor(juror.secondsSinceSeen)} s`;
    alerts.push({
      id: `juror-${juror.id}`,
      level: "critical",
      title: `${juror.name} ${since}`,
      detail: "Su portal dejó de responder. Puedes esperar o revelar con los jurados presentes.",
      action: "rescue",
    });
  }
  const jurorsLevel: HealthLevel =
    offlineJurors.length === 0
      ? "ok"
      : voting && offlineJurors.some((juror) => !juror.sent)
        ? "critical"
        : "warning";

  // Teléfonos.
  let phonesLevel: HealthLevel = "ok";
  if (marketOpen && input.attendeesTotal > 0) {
    const ratio = input.attendeesOnline / input.attendeesTotal;
    if (input.attendeesOnline === 0) phonesLevel = "critical";
    else if (ratio < PHONES_WARNING_RATIO) phonesLevel = "warning";
  }
  if (phonesLevel !== "ok") {
    alerts.push({
      id: `phones-${phonesLevel}`,
      level: phonesLevel === "critical" ? "critical" : "warning",
      title:
        phonesLevel === "critical"
          ? "Ningún teléfono conectado con el mercado abierto"
          : `Solo ${input.attendeesOnline} de ${input.attendeesTotal} teléfonos conectados`,
      detail:
        phonesLevel === "critical"
          ? "Los asistentes no pueden invertir. Revisa el wifi o pausa la fase."
          : "Puede haber problemas de red en la sala. Pide que recarguen la página.",
      action: "attendees",
    });
  }

  const signals: HealthSignal[] = [
    {
      id: "db",
      label: "Base de datos",
      value: `${(input.dbLatencyMs / 1000).toFixed(1)} s`,
      level: db,
    },
    {
      id: "jurors",
      label: "Jurados",
      value: `${jurorsOnline} de ${input.jurors.length}`,
      level: jurorsLevel,
    },
    {
      id: "phones",
      label: "Teléfonos",
      value: String(input.attendeesOnline),
      level: phonesLevel,
    },
  ];

  // Primero las críticas.
  alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "critical" ? -1 : 1));

  return {
    serverTime: input.now.toISOString(),
    signals,
    alerts,
    dbLatencyMs: input.dbLatencyMs,
    attendeesOnline: input.attendeesOnline,
    attendeesTotal: input.attendeesTotal,
  };
}

/**
 * Alerta de la consola sin respuesta del servidor, calculada en el navegador. Tras 90 s sugiere el
 * modo manual (RF-27). Null mientras la consola recibe datos.
 */
export function connectionAlert(secondsSinceOk: number): HealthAlert | null {
  if (secondsSinceOk < CONSOLE_STALE_SECONDS) return null;
  const seconds = Math.floor(secondsSinceOk);
  const manual = seconds >= MANUAL_MODE_SUGGESTION_SECONDS;
  return {
    id: manual ? "connection-manual" : "connection",
    level: "critical",
    title: `La consola no recibe datos hace ${seconds} s`,
    detail: manual
      ? "La aplicación no responde por más de 90 s. Activa el modo manual para conservar el último corte."
      : "Reintentando. Revisa la conexión de esta laptop.",
    action: manual ? "manual_mode" : "retry",
  };
}
