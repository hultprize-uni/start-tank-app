import { LandingPage, landingMetadata } from "@/features/landing";

/* Metadatos de la portada, con SEO y etiquetas Open Graph. */
export const metadata = landingMetadata;

/* Portada pública del evento. Sus enlaces llevan a los portales y a la inscripción. */
export default function Page() {
  return <LandingPage />;
}
