import { LiveDot } from "@/shared/ui";
import { LOGIN_HREF } from "../content";
import { CtaLink } from "./CtaLink";
import { HeroMarketCard } from "./HeroMarketCard";
import styles from "./landing.module.css";

/* Portada: titular con entrada escalonada, propuesta de valor, CTA y demo de mercado en vivo. */
export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <p className={`${styles.pill} ${styles.enter}`}>
          <LiveDot tone="cyan" />
          Jueves 26 de noviembre, 2:00 p. m.
        </p>
        <h1 id="hero-title" className={styles.heroTitle}>
          <span className={styles.enter}>Cinco startups.</span>{" "}
          <span className={styles.enter}>Tu capital.</span>{" "}
          <span className={styles.enter}>El jurado decide.</span>
        </h1>
        <p className={`${styles.lead} ${styles.enter}`}>
          El Shark Tank de Hult Prize at UNI. Invierte en vivo desde tu teléfono y gana si eliges
          como el jurado.
        </p>
        <div className={`${styles.ctaRow} ${styles.enter}`}>
          <CtaLink href={LOGIN_HREF}>Entrar a invertir</CtaLink>
          <CtaLink href="#como-se-juega" variant="ghost">
            Ver cómo se juega
          </CtaLink>
        </div>
      </div>
      <div className={`${styles.heroCard} ${styles.enterCard}`}>
        <HeroMarketCard />
      </div>
    </section>
  );
}
