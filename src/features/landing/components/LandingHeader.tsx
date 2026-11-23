import Link from "next/link";
import { BrandLogo } from "@/shared/ui";
import { LOGIN_HREF, NAV_SECTIONS } from "../content";
import { CtaLink } from "./CtaLink";
import styles from "./landing.module.css";

/* Encabezado: marca, navegación por secciones y el acceso a invertir. */
export function LandingHeader() {
  return (
    <header className={styles.header}>
      <nav aria-label="Principal" className={styles.nav}>
        <Link href="/" className={styles.brand} aria-label="Start Tank, inicio">
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
        <CtaLink href={LOGIN_HREF} className={styles.navCta}>
          Entrar a invertir
        </CtaLink>
      </nav>
    </header>
  );
}
