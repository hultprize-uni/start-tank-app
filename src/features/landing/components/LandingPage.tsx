import { EVENT_JSON_LD } from "../content";
import { EventFacts } from "./EventFacts";
import { HeroSection } from "./HeroSection";
import { LandingFooter } from "./LandingFooter";
import { LandingHeader } from "./LandingHeader";
import { PlatformSection } from "./PlatformSection";
import { ProgramSection } from "./ProgramSection";
import { RulesSection } from "./RulesSection";
import { SignupSection } from "./SignupSection";
import { StartupCallSection } from "./StartupCallSection";
import styles from "./landing.module.css";

/*
 * Portada pública del evento. Ensambla las secciones en el orden del prototipo. Los datos
 * estructurados del evento se incluyen para los buscadores; el contenido es estático y no se
 * obtiene de la base de datos.
 */
export function LandingPage() {
  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(EVENT_JSON_LD) }}
      />
      <LandingHeader />
      <main id="contenido">
        <HeroSection />
        <EventFacts />
        <ProgramSection />
        <RulesSection />
        <PlatformSection />
        <StartupCallSection />
        <SignupSection />
      </main>
      <LandingFooter />
    </div>
  );
}
