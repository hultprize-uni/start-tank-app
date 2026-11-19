import Link from "next/link";
import { BrandLogo } from "@/shared/ui";
import { PLATFORM_MODULES } from "../content";
import styles from "./landing.module.css";

/* Pie de la portada: identidad del evento y accesos a los módulos. */
export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <BrandLogo variant="horizontal" className={styles.footerLogo} />
          <div>
            <p className={styles.footerName}>Hult Prize at UNI</p>
            <p className={styles.footerTagline}>Ideas con impacto</p>
            <p className={styles.footerCredit}>
              EF Hult Prize junto a la Universidad Nacional de Ingeniería
            </p>
          </div>
        </div>
        <nav aria-label="Módulos de la plataforma" className={styles.footerNav}>
          <Link href={PLATFORM_MODULES.investor.href}>Inversionista</Link>
          <Link href={PLATFORM_MODULES.jury.href}>Jurado</Link>
          <Link href={PLATFORM_MODULES.operator.href}>Operador</Link>
          <Link href={PLATFORM_MODULES.screen.href}>Pantalla</Link>
        </nav>
      </div>
    </footer>
  );
}
