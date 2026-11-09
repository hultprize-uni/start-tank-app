import type { RoundInfo, StartupInfo } from "@/lib/api/investor.types";
import { StatusBadge } from "./StatusBadge";
import styles from "./ScheduledScreen.module.css";

interface ScheduledScreenProps {
  round: RoundInfo;
  startup: StartupInfo;
}

/** Espera de la ronda: muestra la startup que se presentará antes de abrir el mercado. */
export function ScheduledScreen({ round, startup }: ScheduledScreenProps) {
  return (
    <section className={styles.screen}>
      <StatusBadge tone="yellow">
        Ronda {round.number} de {round.total} · Programada
      </StatusBadge>
      <h1 className={styles.name}>{startup.name}</h1>
      <p className={styles.ods}>{startup.ods}</p>
      <p className={styles.description}>{startup.description}</p>
      <p className={styles.note}>
        El operador abrirá el mercado en cuanto empiece el pitch. Esta pantalla se actualiza sola.
      </p>
    </section>
  );
}
