import Link from "next/link";
import { PLATFORM_MODULES } from "../content";
import styles from "./landing.module.css";

/* Módulos de la plataforma. Cada tarjeta enlaza al portal que le corresponde. */
export function PlatformSection() {
  const screen = PLATFORM_MODULES.screen;

  return (
    <section id="plataforma" className={styles.section} aria-labelledby="platform-title">
      <div className={styles.container}>
        <h2 id="platform-title" className={styles.sectionTitle}>
          Cuatro módulos, una sola base de datos
        </h2>
        <p className={styles.sectionLead}>
          Cada rol entra a su propio módulo y no puede ejecutar las acciones de los otros. Abre cada
          uno en una pestaña distinta: comparten el estado del evento en vivo.
        </p>
        <div className={styles.moduleGrid}>
          <Link href={screen.href} className={`${styles.module} ${styles.moduleScreen}`}>
            <span className={styles.moduleTitle}>{screen.title}</span>
            <span className={styles.moduleText}>{screen.text}</span>
            <span className={styles.moduleAction}>Abrir módulo</span>
          </Link>
          <Link
            href={PLATFORM_MODULES.investor.href}
            className={`${styles.module} ${styles.moduleInvestor}`}
          >
            <span className={styles.moduleTitle}>{PLATFORM_MODULES.investor.title}</span>
            <span className={styles.moduleText}>{PLATFORM_MODULES.investor.text}</span>
            <span className={styles.moduleAction}>Abrir módulo</span>
          </Link>
          <Link href={PLATFORM_MODULES.jury.href} className={`${styles.module} ${styles.moduleJury}`}>
            <span className={styles.moduleTitle}>{PLATFORM_MODULES.jury.title}</span>
            <span className={styles.moduleText}>{PLATFORM_MODULES.jury.text}</span>
            <span className={styles.moduleAction}>Abrir módulo</span>
          </Link>
          <Link
            href={PLATFORM_MODULES.operator.href}
            className={`${styles.module} ${styles.moduleOperator}`}
          >
            <span className={styles.moduleTitle}>{PLATFORM_MODULES.operator.title}</span>
            <span className={styles.moduleText}>{PLATFORM_MODULES.operator.text}</span>
            <span className={styles.moduleAction}>Abrir módulo</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
