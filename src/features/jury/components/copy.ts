import type { BadgeTone } from "@/shared/ui";
import { formatScore } from "../criteria";
import type { JuryPhase, JuryRailItem } from "../types";

/*
 * Textos de interfaz del portal del jurado. Los componentes los consumen desde este módulo para
 * que el copy quede en un único lugar y los componentes sigan siendo presentacionales.
 */

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
    waitText: "Espera a que el operador inicie el pitch.",
  },
  pitch: {
    name: "Pitch",
    tone: "cyan",
    live: true,
    waitTitle: "",
    waitText: "",
  },
  open: {
    name: "Mercado abierto",
    tone: "cyan",
    live: true,
    waitTitle: "",
    waitText: "",
  },
  last_call: {
    name: "Última llamada",
    tone: "cyan",
    live: true,
    waitTitle: "",
    waitText: "",
  },
  closed: {
    name: "Mercado cerrado",
    tone: "yellow",
    live: false,
    waitTitle: "",
    waitText: "",
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
    waitText: "El operador anuló esta ronda. No se necesita tu envío.",
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
  if (item.ownVerdict === null) return "Sin envío";
  if (item.ownVerdict.abstained) return "Se abstuvo";
  return item.ownVerdict.score === null
    ? "Enviado"
    : `Tu puntaje: ${formatScore(item.ownVerdict.score)} / 5`;
}
