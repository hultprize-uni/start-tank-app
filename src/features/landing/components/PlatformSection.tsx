import Link from "next/link";
import { LOGIN_HREF, PLATFORM_SCREENS } from "../content";
import { CtaLink } from "./CtaLink";
import styles from "./landing.module.css";

const SCREEN_TONE = { cyan: styles.screenCyan, pink: styles.screenPink, muted: styles.screenMuted };

/* Plataforma: el teléfono del asistente y las otras tres pantallas conectadas. */
export function PlatformSection() {
  return (
    <section id="plataforma" className={styles.section} aria-labelledby="platform-title">
      <div className={styles.container}>
        <h2 id="platform-title" className={styles.sectionTitle} data-reveal="sweep">
          Una plataforma, cuatro pantallas conectadas
        </h2>
        <div className={styles.platform}>
          <article className={styles.phoneCard} data-reveal>
            <p className={styles.cardTag}>Tu teléfono</p>
            <h3 className={styles.phoneTitle}>Inviertes, ves el precio en vivo y tu posición en la tabla.</h3>
            <CtaLink href={LOGIN_HREF} variant="ghost">
              Entrar a invertir
            </CtaLink>
          </article>
          <ul className={styles.screens}>
            {PLATFORM_SCREENS.map((screen, index) => (
              <li
                key={screen.title}
                className={`${styles.screenCard} ${SCREEN_TONE[screen.tone]}`}
                data-reveal
                style={{ "--reveal-delay": `${120 + index * 100}ms` } as React.CSSProperties}
              >
                <h3 className={styles.screenTitle}>
                  <Link href={screen.href}>{screen.title}</Link>
                </h3>
                <p className={styles.screenText}>{screen.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
