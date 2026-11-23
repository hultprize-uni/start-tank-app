import { EVENT_JSON_LD } from "../content";
import { EventFacts } from "./EventFacts";
import { HeroSection } from "./HeroSection";
import { LandingFooter } from "./LandingFooter";
import { LandingHeader } from "./LandingHeader";
import { PlatformSection } from "./PlatformSection";
import { PrizesSection } from "./PrizesSection";
import { ProgramSection } from "./ProgramSection";
import { RulesSection } from "./RulesSection";
import { SignupSection } from "./SignupSection";
import styles from "./landing.module.css";

/*
 * Portada pública del evento, en el orden del diseño de Figma (02 Landing). El contenido es
 * estático; los datos estructurados del evento se incluyen para los buscadores.
 */
export function LandingPage() {
  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(EVENT_JSON_LD) }}
      />
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>
      <LandingHeader />
      <main id="contenido">
        <HeroSection />
        <EventFacts />
        <RulesSection />
        <ProgramSection />
        <PlatformSection />
        <PrizesSection />
        <SignupSection />
      </main>
      <LandingFooter />
    </div>
  );
}
