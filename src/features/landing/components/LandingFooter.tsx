import Image from "next/image";
import styles from "./landing.module.css";

/* Pie de la portada, con la marca de Hult Prize at UNI. */
export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerRow}`}>
        <Image
          src="/brand/logo-ef-hult-prize.png"
          alt="EF Hult Prize at UNI"
          width={383}
          height={261}
          className={styles.footerLogo}
        />
        <p className={styles.footerText}>Hult Prize at UNI. Universidad Nacional de Ingeniería, Lima.</p>
      </div>
    </footer>
  );
}
