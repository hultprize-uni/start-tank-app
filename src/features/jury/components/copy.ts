import type { Decision } from "@/shared/domain/types";
import type { BadgeTone } from "@/shared/ui";
import type { JuryPhase, JuryRailItem } from "../types";

/*
 * Textos de interfaz del portal del jurado. Los componentes los consumen desde este módulo para
 * que el copy quede en un único lugar y los componentes sigan siendo presentacionales.
 */

/** Textos y etiquetas de cada decisión de voto. */
export interface DecisionCopy {
  /** Opción de la votación. */
  choice: string;
  /** Explicación breve de la opción. */
  description: string;
  /** Etiqueta en el veredicto y en el historial. */
  record: string;
  /** Frase de la confirmación del voto definitivo. */
  confirmation: string;
}

export const DECISION_COPY: Readonly<Record<Decision, DecisionCopy>> = {
  BACK: {
    choice: "Respalda",
    description: "La startup convence en negocio e impacto.",
    record: "Respalda",
    confirmation: "Esta startup recibe tu respaldo.",
  },
  REJECT: {
    choice: "Rechaza",
    description: "No la respaldo tal como la presentó.",
    record: "Rechaza",
    confirmation: "Esta startup no recibe tu respaldo.",
  },
  ABSTAIN: {
    choice: "Me abstengo",
    description: "Declaro conflicto de interés.",
    record: "Se abstiene",
    confirmation: "No participas en la decisión por conflicto de interés.",
  },
};

/** Orden en que se presentan las decisiones de voto. */
export const DECISION_ORDER: readonly Decision[] = ["BACK", "REJECT", "ABSTAIN"];

/** Nombre, tono de la etiqueta de estado y textos de espera de cada fase. */
export interface PhaseCopy {
  name: string;
  tone: BadgeTone;
  live: boolean;
  /** Título de la pantalla de espera. Vacío cuando la fase no muestra espera. */
  waitTitle: string;
  waitText: string;
}

export const PHASE_COPY: Readonly<Record<JuryPhase, PhaseCopy>> = {
  scheduled: {
    name: "Programada",
    tone: "yellow",
    live: false,
    waitTitle: "Aún no empieza esta ronda",
    waitText: "Espera a que el operador abra el mercado.",
  },
  open: {
    name: "Mercado abierto",
    tone: "cyan",
    live: true,
    waitTitle: "Pitch en curso",
    waitText: "El operador habilitará el voto cuando cierre el mercado.",
  },
  last_call: {
    name: "Última llamada",
    tone: "cyan",
    live: true,
    waitTitle: "Última llamada",
    waitText: "El mercado está por cerrar. Tu voto se habilita después.",
  },
  closed: {
    name: "Mercado cerrado",
    tone: "yellow",
    live: false,
    waitTitle: "Mercado cerrado",
    waitText: "El operador habilitará el voto en un momento.",
  },
  voting: {
    name: "Votación abierta",
    tone: "pink",
    live: true,
    waitTitle: "",
    waitText: "",
  },
  result: {
    name: "Liquidada",
    tone: "yellow",
    live: false,
    waitTitle: "",
    waitText: "",
  },
  cancelled: {
    name: "Anulada",
    tone: "yellow",
    live: false,
    waitTitle: "Ronda anulada",
    waitText: "El operador anuló esta ronda. No se necesita tu voto.",
  },
  final: {
    name: "Evento cerrado",
    tone: "yellow",
    live: false,
    waitTitle: "Evento cerrado",
    waitText: "Gracias por tu participación como jurado.",
  },
};

/** Texto de apoyo de cada entrada del recorrido de rondas. */
export function railStatusText(item: JuryRailItem): string {
  if (item.status === "current") return "En escena";
  if (item.status === "pending") return "Pendiente";
  if (item.ownDecision === null) return "Sin voto";
  return `Tu voto: ${DECISION_COPY[item.ownDecision].record}`;
}
