import { SIGNUP_HREF } from "../content";
import { CtaLink } from "./CtaLink";
import { HeroMarketCard } from "./HeroMarketCard";
import styles from "./landing.module.css";

/* Presentación del evento: titular, propuesta de valor, CTA y tarjeta de mercado. */
export function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <h1 id="hero-title" className={styles.heroTitle}>
          El público invierte.
          <br />
          <span className={styles.accentPink}>El jurado decide.</span>
        </h1>
        <p className={styles.lead}>
          Cada asistente recibe 10,000 Impact Coins y los invierte en vivo, desde su teléfono,
          mientras las cinco startups presentan.
        </p>
        <div className={styles.ctaRow}>
          <CtaLink href={SIGNUP_HREF}>Inscríbete en Luma</CtaLink>
          <CtaLink href="#plataforma" variant="ghost">
            Conoce la plataforma
          </CtaLink>
        </div>
        <p className={styles.eventLine}>
          Shark Tank Universitario, Edición Impacto ODS. Jueves 26 de noviembre, 2:00 p. m.,
          Auditorio CTIC.
        </p>
        <p className={styles.credit}>
          EF Hult Prize junto a la Universidad Nacional de Ingeniería
        </p>
      </div>
      <div className={styles.heroCard}>
        <HeroMarketCard />
      </div>
    </section>
  );
}
