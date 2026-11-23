import { BrandLogo } from "@/shared/ui";
import styles from "./landing.module.css";

/* Pie de la portada. */
export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerRow}`}>
        <BrandLogo variant="horizontal" className={styles.footerLogo} />
        <p className={styles.footerText}>Hult Prize at UNI. Universidad Nacional de Ingeniería, Lima.</p>
      </div>
    </footer>
  );
}
