import { BrandLogo } from "@/shared/ui";
import styles from "./JuryMobileHeader.module.css";

interface JuryMobileHeaderProps {
  jurorLabel: string;
}

/** Encabezado de pantallas estrechas: logotipo e identidad de la sesión. */
export function JuryMobileHeader({ jurorLabel }: JuryMobileHeaderProps) {
  return (
    <header className={styles.header}>
      <BrandLogo variant="horizontal" alt="Start Tank" className={styles.logo} />
      <div className={styles.session}>
        <p className={styles.caption}>Sesión</p>
        <p className={styles.juror}>{jurorLabel}</p>
      </div>
    </header>
  );
}
