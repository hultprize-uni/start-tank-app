import { PAGE_ROUTES } from "@/shared/lib/api-routes";

/*
 * Textos y datos de la portada del evento. El copy se conserva del prototipo de la landing. Las
 * rutas internas usan las constantes de PAGE_ROUTES; el prototipo no define URL externas.
 */

/** Tono de color de un elemento de cronograma o de una fase, asignado por token. */
export type LandingTone = "cyan" | "cyanLight" | "pink" | "orchid" | "yellow" | "muted";

export interface ScheduleItem {
  time: string;
  text: string;
  tone: LandingTone;
}

export interface EventFact {
  label: string;
  value: string;
  tone: LandingTone;
}

export const NAV_SECTIONS = [
  { href: "#evento", label: "El evento" },
  { href: "#programa", label: "Programa" },
  { href: "#reglas", label: "Reglas" },
  { href: "#plataforma", label: "Plataforma" },
] as const;

/** Destino del CTA de ingreso de la aplicación. */
export const LOGIN_HREF = PAGE_ROUTES.participant;

/** Destino del CTA de inscripción, tal como figura en el prototipo. */
export const SIGNUP_HREF = "#inscripcion";

export const EVENT_FACTS: EventFact[] = [
  { value: "80+", label: "asistentes en el Auditorio CTIC", tone: "cyan" },
  { value: "5", label: "startups alineadas a los ODS", tone: "pink" },
  { value: "4", label: "jurados de incubadoras y docencia", tone: "orchid" },
  { value: "10K", label: "Impact Coins por asistente", tone: "yellow" },
];

export const SHARK_TANK_SCHEDULE: ScheduleItem[] = [
  { time: "14:00", text: "Ingreso y check-in. Cada asistente recibe su post-it de rubro.", tone: "cyan" },
  { time: "14:15", text: "Apertura, reglas de inversión y prueba de carga de la aplicación.", tone: "cyan" },
  { time: "14:30", text: "Rondas 1, 2 y 3. Trece minutos por startup.", tone: "pink" },
  { time: "15:09", text: "Pausa.", tone: "muted" },
  { time: "15:14", text: "Rondas 4 y 5.", tone: "pink" },
  { time: "15:40", text: "Premiación: startup ganadora y los tres mejores inversionistas.", tone: "yellow" },
];

export const PITCH_SCHEDULE: ScheduleItem[] = [
  { time: "15:50", text: "Networking. Los grupos se arman cruzando rubros: negocio, tecnología, impacto y diseño.", tone: "cyan" },
  { time: "16:00", text: "Dos aulas del CTIC, veinte minutos por grupo y dos facilitadores por aula.", tone: "cyan" },
  { time: "16:20", text: "Exposiciones de un minuto ante los cuatro jurados.", tone: "orchid" },
  { time: "16:50", text: "Veredicto, grupo ganador y foto grupal.", tone: "yellow" },
];

/** Fases de una ronda. El ancho de cada segmento de la barra sigue la duración relativa. */
export const ROUND_PHASES = [
  { duration: "4 min", title: "Pitch", text: "La startup presenta. El mercado ya está abierto.", tone: "cyan", weight: 4 },
  { duration: "4 min", title: "Preguntas", text: "Una pregunta por jurado. El precio se mueve con cada respuesta.", tone: "cyanLight", weight: 4 },
  { duration: "1 min", title: "Última llamada", text: "Cuenta regresiva de 60 segundos y cierre del mercado.", tone: "yellow", weight: 1 },
  { duration: "2.5 min", title: "Veredicto", text: "Los cuatro jurados votan a la vez. Nadie ve el voto del otro.", tone: "pink", weight: 2.5 },
  { duration: "1.5 min", title: "Liquidación", text: "El retorno vuelve a cada billetera y el ranking se actualiza.", tone: "orchid", weight: 1.5 },
] as const;

/** Escenarios de retorno según el número de respaldos del jurado (de 0 a 4). */
export const PAYOFF_LEVELS = [
  { multiplier: "0.2x", votes: "0 de 4", note: "Pierde el 80%", tone: "cyan" },
  { multiplier: "0.6x", votes: "1 de 4", note: "Pierde el 40%", tone: "cyan" },
  { multiplier: "1.0x", votes: "2 de 4", note: "Recupera lo puesto", tone: "muted" },
  { multiplier: "1.4x", votes: "3 de 4", note: "Gana el 40%", tone: "pink" },
  { multiplier: "1.8x", votes: "4 de 4", note: "Gana el 80%", tone: "pink" },
] as const;

export const RULE_CARDS = [
  { title: "Compra mínima 250", text: "Y como máximo el 30% de tu saldo en cada ronda." },
  { title: "No se puede vender", text: "Quien invierte se expone al veredicto. No hay salida antes del cierre." },
  { title: "El precio no paga", text: "Marca el interés de la sala. El retorno sale solo del jurado." },
  { title: "Abstención", text: "El jurado con conflicto de interés sale del denominador." },
];

export const PLATFORM_MODULES = {
  screen: {
    href: PAGE_ROUTES.screen,
    title: "Pantalla del evento",
    text: "Proyectada en el auditorio. Precio en vivo, cuenta regresiva, veredicto y ranking. Sin autenticación y sin escrituras.",
  },
  investor: {
    href: PAGE_ROUTES.participant,
    title: "Portal del inversionista",
    text: "Ingreso con OAuth, sin contraseña. Billetera, precio en vivo, cartera y ranking. Tres toques por operación.",
  },
  jury: {
    href: PAGE_ROUTES.jury,
    title: "Portal del jurado",
    text: "Respalda, rechaza o se abstiene. Un voto por ronda. No abre ni cierra el mercado.",
  },
  operator: {
    href: PAGE_ROUTES.operator,
    title: "Portal del operador",
    text: "Abre, cierra, revela y liquida. Cada acción queda registrada con hora y responsable.",
  },
} as const;

export const STARTUP_REQUIREMENTS = [
  { value: "4 min", text: "de pitch ante la sala y el jurado" },
  { value: "4 min", text: "de preguntas, una por cada jurado" },
  { value: "1", text: "presentación enviada antes del evento" },
];

export const EVENT_DETAILS = [
  { label: "Fecha", value: "Jueves 26 de noviembre" },
  { label: "Hora", value: "2:00 a 5:00 p. m." },
  { label: "Lugar", value: "Auditorio CTIC, UNI" },
  { label: "Costo", value: "Libre para la comunidad UNI" },
];

/** Datos estructurados del evento para buscadores. Las fechas usan la hora de Lima (UTC-5). */
export const EVENT_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "Shark Tank Universitario, Edición Impacto ODS",
  startDate: "2026-11-26T14:00:00-05:00",
  endDate: "2026-11-26T17:00:00-05:00",
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: {
    "@type": "Place",
    name: "Auditorio CTIC, UNI",
    address: { "@type": "PostalAddress", addressLocality: "Lima", addressCountry: "PE" },
  },
  organizer: { "@type": "Organization", name: "Hult Prize at UNI" },
  description:
    "Shark Tank Universitario de Hult Prize at UNI. El público invierte en vivo y el jurado decide.",
};
