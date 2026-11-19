import { Badge } from "@/shared/ui";
import type { RoundInfo, StartupInfo } from "../types";
import styles from "./ScheduledScreen.module.css";

interface ScheduledScreenProps {
  round: RoundInfo;
  startup: StartupInfo;
}

/** Espera de la ronda: muestra la startup que se presentará antes de abrir el mercado. */
export function ScheduledScreen({ round, startup }: ScheduledScreenProps) {
  return (
    <section className={styles.screen}>
      <Badge tone="yellow">
        Ronda {round.number} de {round.total} · Programada
      </Badge>
      <h1 className={styles.name}>{startup.name}</h1>
      <p className={styles.sdg}>{startup.sdg}</p>
      <p className={styles.description}>{startup.description}</p>
      <p className={styles.note}>
        El operador abrirá el mercado cuando empiece el pitch. Esta pantalla se actualiza sola.
      </p>
    </section>
  );
}
