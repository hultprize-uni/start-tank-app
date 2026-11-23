import type { Metadata } from "next";

/* Metadatos de la portada: título, descripción y etiquetas Open Graph y Twitter. */
const TITLE = "Start Tank | El Shark Tank de Hult Prize at UNI";
const DESCRIPTION =
  "Cinco startups. Tu capital. El jurado decide. Invierte en vivo desde tu teléfono: jueves 26 de noviembre, 2:00 p. m., Auditorio CTIC, UNI.";

export const landingMetadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["Start Tank", "Hult Prize", "UNI", "Shark Tank", "ODS", "startups", "Impact Coins"],
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "es_PE", siteName: "Start Tank" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};
