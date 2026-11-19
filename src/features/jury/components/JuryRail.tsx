import { BrandLogo, Button } from "@/shared/ui";
import type { JuryRailItem } from "../types";
import { railStatusText } from "./copy";
import styles from "./JuryRail.module.css";

interface JuryRailProps {
  jurorLabel: string;
  rail: readonly JuryRailItem[];
  onLogout: () => void;
}

/** Columna lateral de laptop: identidad del evento, sesión, salida y recorrido de rondas. */
export function JuryRail({ jurorLabel, rail, onLogout }: JuryRailProps) {
  return (
    <aside className={styles.rail} aria-label="Recorrido del evento">
      <BrandLogo variant="horizontal" alt="Start Tank" className={styles.logo} />
      <p className={styles.event}>
        Shark Tank Universitario
        <br />
        26 Nov · Auditorio CTIC
      </p>

      <div className={styles.session}>
        <p className={styles.caption}>Sesión</p>
        <p className={styles.juror}>{jurorLabel}</p>
      </div>

      <Button variant="ghost" size="md" fullWidth onClick={onLogout}>
        Salir
      </Button>

      <p className={styles.caption}>Rondas</p>
      <ol className={styles.rounds}>
        {rail.map((item) => (
          <li
            key={item.number}
            className={`${styles.round} ${styles[item.status]}`}
            aria-current={item.status === "current" ? "step" : undefined}
          >
            <span className={styles.index} aria-hidden="true">
              {item.number}
            </span>
            <div className={styles.text}>
              <p className={styles.name}>{item.startupName}</p>
              <p className={styles.sub}>{railStatusText(item)}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
