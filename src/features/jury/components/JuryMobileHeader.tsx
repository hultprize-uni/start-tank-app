import { BrandLogo, Button } from "@/shared/ui";
import styles from "./JuryMobileHeader.module.css";

interface JuryMobileHeaderProps {
  jurorLabel: string;
  onLogout: () => void;
}

/**
 * Encabezado de pantallas estrechas: logotipo, identidad de la sesión y botón para salir a la
 * pantalla de acceso, en la esquina superior derecha.
 */
export function JuryMobileHeader({ jurorLabel, onLogout }: JuryMobileHeaderProps) {
  return (
    <header className={styles.header}>
      <BrandLogo variant="horizontal" alt="Start Tank" className={styles.logo} />
      <div className={styles.end}>
        <div className={styles.session}>
          <p className={styles.caption}>Sesión</p>
          <p className={styles.juror}>{jurorLabel}</p>
        </div>
        <Button variant="ghost" size="md" onClick={onLogout}>
          Salir
        </Button>
      </div>
    </header>
  );
}
