import { EVENT_JSON_LD } from "../content";
import { EventFacts } from "./EventFacts";
import { HeroSection } from "./HeroSection";
import { LandingFooter } from "./LandingFooter";
import { LandingHeader } from "./LandingHeader";
import { LandingIntro } from "./LandingIntro";
import { PlatformSection } from "./PlatformSection";
import { ProgramSection } from "./ProgramSection";
import { StartupsSection } from "./StartupsSection";
import { RulesSection } from "./RulesSection";
import { ScrollReveal } from "./ScrollReveal";
import { SignupSection } from "./SignupSection";
import styles from "./landing.module.css";

/*
 * Portada pública del evento, en el orden del diseño de Figma (02 Landing). El contenido es
 * estático; los datos estructurados del evento se incluyen para los buscadores.
 */
export function LandingPage() {
  return (
    <div className={styles.page} data-reveal-root>
      <LandingIntro />
      <ScrollReveal />
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
        <StartupsSection />
        <PlatformSection />
        <SignupSection />
      </main>
      <LandingFooter />
    </div>
  );
}
