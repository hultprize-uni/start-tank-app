import type { Metadata } from "next";

/*
 * Metadatos de la portada: título, descripción, etiquetas Open Graph y Twitter. El título sigue la
 * convención de la marca; la descripción resume el evento con fecha y lugar.
 */
export const landingMetadata: Metadata = {
  title: "Start Tank | Shark Tank Universitario de Hult Prize at UNI",
  description:
    "El público invierte y el jurado decide. Shark Tank Universitario, Edición Impacto ODS: jueves 26 de noviembre, 2:00 p. m., Auditorio CTIC, UNI.",
  keywords: ["Start Tank", "Hult Prize", "UNI", "Shark Tank", "ODS", "startups", "Impact Coins"],
  openGraph: {
    title: "Start Tank | Shark Tank Universitario de Hult Prize at UNI",
    description:
      "El público invierte en vivo y el jurado decide. Shark Tank Universitario, Edición Impacto ODS.",
    type: "website",
    locale: "es_PE",
    siteName: "Start Tank",
  },
  twitter: {
    card: "summary",
    title: "Start Tank | Shark Tank Universitario de Hult Prize at UNI",
    description:
      "El público invierte en vivo y el jurado decide. Shark Tank Universitario, Edición Impacto ODS.",
  },
};
