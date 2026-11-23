import { PAGE_ROUTES } from "@/shared/lib/api-routes";

/*
 * Textos y datos de la portada del evento, tomados del diseño de Figma (página 02 Landing) y de las
 * reglas vigentes de BASES.md.
 */

export const NAV_SECTIONS = [
  { href: "#evento", label: "El evento" },
  { href: "#como-se-juega", label: "Cómo se juega" },
  { href: "#programa", label: "Programa" },
  { href: "#plataforma", label: "Plataforma" },
] as const;

/** Destino del CTA de ingreso de la aplicación. */
export const LOGIN_HREF = PAGE_ROUTES.participant;

/**
 * Inscripción en Luma. shortcut: sin NEXT_PUBLIC_LUMA_URL el botón lleva a la sección de
 * inscripción; definirla en el despliegue con el enlace real del evento.
 */
export const SIGNUP_HREF = process.env.NEXT_PUBLIC_LUMA_URL || "#inscripcion";

export const EVENT_FACTS = [
  { value: "26 nov", label: "Jueves" },
  { value: "2:00 p. m.", label: "a 5:00 p. m." },
  { value: "CTIC", label: "Auditorio, UNI" },
  { value: "80 a 100", label: "asistentes con Luma" },
] as const;

/** Pasos del juego, en orden. */
export const HOW_TO_PLAY = [
  {
    title: "Entras con 10,000 IC",
    text: "Escaneas el QR de la pantalla y entras con tu cuenta de Google. Sin descargas.",
  },
  {
    title: "Inviertes en la startup en escena",
    text: "Desde 250 IC hasta el 30% de tu saldo. Una sola vez por ronda.",
  },
  {
    title: "El jurado califica del 1 al 5",
    text: "Cuatro criterios: problema, negocio, impacto ODS y equipo.",
  },
  {
    title: "El multiplicador mueve tu saldo",
    text: "Con 3 de 5 recuperas lo invertido. Con 5 de 5, casi lo duplicas.",
  },
] as const;

/** Multiplicador por puntaje del jurado: 0.2 + 1.6 × (puntaje − 1) / 4. */
export const MULTIPLIER_BARS = [
  { score: 1, multiplier: "0.2x" },
  { score: 2, multiplier: "0.6x" },
  { score: 3, multiplier: "1.0x" },
  { score: 4, multiplier: "1.4x" },
  { score: 5, multiplier: "1.8x" },
] as const;

export interface ScheduleItem {
  time: string;
  title: string;
  text: string;
}

export const SCHEDULE: ScheduleItem[] = [
  { time: "14:00", title: "Ingreso y check-in", text: "Recibes tu post-it de rubro, sticker y pin." },
  { time: "14:15", title: "Apertura", text: "Hult Prize at UNI, reglas y presentación del jurado." },
  { time: "14:30", title: "Rondas 1 a 3", text: "Las tres primeras startups." },
  { time: "15:09", title: "Pausa", text: "Agua y descanso." },
  { time: "15:14", title: "Rondas 4 y 5", text: "Las dos últimas startups." },
  { time: "15:40", title: "Premiación del Shark Tank", text: "Startup ganadora y top 3 de inversionistas." },
  { time: "15:50", title: "Networking y dinámica express", text: "Grupos de 3 a 5 crean una idea en 20 minutos." },
  { time: "16:50", title: "Premiación y cierre", text: "Grupo ganador y foto final." },
];

export const PLATFORM_SCREENS = [
  {
    href: PAGE_ROUTES.screen,
    title: "Pantalla del auditorio",
    text: "La curva de la sala, la tabla de inversores y el veredicto en grande.",
    tone: "cyan",
  },
  {
    href: PAGE_ROUTES.jury,
    title: "Portal del jurado",
    text: "Cuatro jurados califican del 1 al 5. Nadie ve las notas antes del veredicto.",
    tone: "pink",
  },
  {
    href: PAGE_ROUTES.operator,
    title: "Consola del operador",
    text: "Abre y cierra rondas, revela el veredicto y vigila la salud del sistema.",
    tone: "muted",
  },
] as const;

export const PRIZES = [
  {
    tag: "Shark Tank",
    title: "Pase directo a la gran final de Hult Prize at UNI",
    text: "Para la startup con el mayor puntaje al cierre de las 5 rondas.",
    tone: "pink",
  },
  {
    tag: "Idea millonaria en 20 minutos",
    title: "Pase directo a Hult Prize at UNI con esa misma idea",
    text: "Para el grupo ganador de la dinámica express.",
    tone: "cyan",
  },
] as const;

/** Datos estructurados del evento para buscadores. Las fechas usan la hora de Lima (UTC-5). */
export const EVENT_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "Start Tank: Shark Tank Universitario de Hult Prize at UNI",
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
    "Cinco startups. Tu capital. El jurado decide. Invierte en vivo desde tu teléfono en el Shark Tank de Hult Prize at UNI.",
};
