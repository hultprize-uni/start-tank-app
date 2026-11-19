import Link from "next/link";
import { BrandLogo } from "@/shared/ui";
import { LOGIN_HREF, NAV_SECTIONS, SIGNUP_HREF } from "../content";
import { CtaLink } from "./CtaLink";
import styles from "./landing.module.css";

/* Encabezado de la portada: marca, navegación por secciones y los dos CTA principales. */
export function LandingHeader() {
  return (
    <header className={styles.header}>
      <nav aria-label="Principal" className={styles.nav}>
        <Link href="/" className={styles.brand}>
          <BrandLogo variant="horizontal" priority className={styles.brandLogo} />
        </Link>
        <ul className={styles.navLinks}>
          {NAV_SECTIONS.map((section) => (
            <li key={section.href}>
              <a href={section.href} className={styles.navLink}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
        <div className={styles.navActions}>
          <CtaLink href={LOGIN_HREF} variant="ghost">
            Ingresar
          </CtaLink>
          <CtaLink href={SIGNUP_HREF}>Inscríbete en Luma</CtaLink>
        </div>
      </nav>
    </header>
  );
}
