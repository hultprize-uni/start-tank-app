import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PAGE_ROUTES } from "@/shared/lib/api-routes";
import { LOGIN_HREF, NAV_SECTIONS, SIGNUP_HREF } from "../content";
import { CtaLink } from "./CtaLink";
import styles from "./landing.module.css";

const SOCIAL_LINKS = [
  { label: "Instagram de Hult Prize at UNI", href: "https://www.instagram.com/hultprize_uni/", icon: "instagram" },
  { label: "LinkedIn de Hult Prize at UNI", href: "https://www.linkedin.com/company/hult-prize-at-uni/", icon: "linkedin" },
] as const;

const PORTAL_LINKS = [
  { label: "Invertir", href: LOGIN_HREF },
  { label: "Pantalla", href: PAGE_ROUTES.screen },
  { label: "Jurado", href: PAGE_ROUTES.jury },
  { label: "Operador", href: PAGE_ROUTES.operator },
] as const;

/* Trazos de Tabler Icons (MIT), dibujados a 24 px con trazo de 1.75. */
const ICONS: Record<"instagram" | "linkedin" | "pin" | "calendar", ReactNode> = {
  instagram: (
    <>
      <path d="M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M16.5 7.5v.01" />
    </>
  ),
  linkedin: (
    <>
      <path d="M8 11v5" />
      <path d="M8 8v.01" />
      <path d="M12 16v-5" />
      <path d="M16 16v-3a2 2 0 1 0 -4 0" />
      <path d="M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4z" />
    </>
  ),
  pin: (
    <>
      <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" />
    </>
  ),
  calendar: (
    <>
      <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M4 11h16" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

/* Pie de la portada: marca y redes, navegación, portales y datos de contacto del evento. */
export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div className={styles.footerBrand} data-reveal>
          <Image
            src="/brand/logo-ef-hult-prize.png"
            alt="EF Hult Prize at UNI"
            width={357}
            height={257}
            className={styles.footerLogo}
          />
          <p className={styles.footerText}>
            Start Tank es el Shark Tank de Hult Prize at UNI, la competencia universitaria de emprendimiento de
            impacto de la Universidad Nacional de Ingeniería.
          </p>
          <ul className={styles.socials} aria-label="Redes sociales">
            {SOCIAL_LINKS.map((social) => (
              <li key={social.icon}>
                <a
                  href={social.href}
                  className={styles.social}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                >
                  <Icon name={social.icon} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Secciones" className={styles.footerCol} data-reveal style={{ "--reveal-delay": "80ms" } as React.CSSProperties}>
          <h2 className={styles.footerHeading}>Navegación</h2>
          <ul className={styles.footerLinks}>
            {NAV_SECTIONS.map((section) => (
              <li key={section.href}>
                <a href={section.href} className={styles.footerLink}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Portales" className={styles.footerCol} data-reveal style={{ "--reveal-delay": "160ms" } as React.CSSProperties}>
          <h2 className={styles.footerHeading}>Portales</h2>
          <ul className={styles.footerLinks}>
            {PORTAL_LINKS.map((portal) => (
              <li key={portal.href}>
                <Link href={portal.href} className={styles.footerLink}>
                  {portal.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.footerCol} data-reveal style={{ "--reveal-delay": "240ms" } as React.CSSProperties}>
          <h2 className={styles.footerHeading}>Contacto</h2>
          <ul className={styles.footerContact}>
            <li>
              <Icon name="pin" />
              <span>
                Auditorio CTIC, Universidad Nacional de Ingeniería. Av. Túpac Amaru 210, Rímac, Lima
              </span>
            </li>
            <li>
              <Icon name="calendar" />
              <span>Jueves 26 de noviembre, 2:00 p. m.</span>
            </li>
          </ul>
          <CtaLink href={SIGNUP_HREF} variant="ghost" className={styles.footerCta}>
            Inscribirme en Luma
          </CtaLink>
        </div>
      </div>

      <div className={`${styles.container} ${styles.footerBottom}`}>
        <p>© 2026 Hult Prize at UNI</p>
        <p>Start Tank, Shark Tank Universitario</p>
      </div>
    </footer>
  );
}
