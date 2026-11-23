import { Badge } from "@/shared/ui";
import { formatCoins } from "../format";
import type { RoundInfo, StartupInfo } from "../types";
import styles from "./ScheduledScreen.module.css";

interface ScheduledScreenProps {
  round: RoundInfo;
  startup: StartupInfo;
  balance: number;
  /** Aciertos seguidos: la racha de mejor ojo. */
  streak: number;
}

/** Espera antes de la ronda (RF-23): la startup que viene, tu saldo y tu racha de mejor ojo. */
export function ScheduledScreen({ round, startup, balance, streak }: ScheduledScreenProps) {
  return (
    <section className={styles.screen}>
      <Badge tone="yellow">
        Ronda {round.number} de {round.total} · Programada
      </Badge>
      <h1 className={styles.name}>{startup.name}</h1>
      <p className={styles.sdg}>{startup.sdg}</p>
      <p className={styles.description}>{startup.description}</p>
      <dl className={styles.facts}>
        <div>
          <dt className={styles.note}>Tu saldo</dt>
          <dd className={styles.fact}>{formatCoins(balance)} coins</dd>
        </div>
        <div>
          <dt className={styles.note}>Racha de mejor ojo</dt>
          <dd className={styles.fact}>{streak === 1 ? "1 acierto" : `${streak} aciertos`}</dd>
        </div>
      </dl>
      <p className={styles.note}>
        El mercado abre cuando empiece el pitch. Esta pantalla se actualiza sola.
      </p>
    </section>
  );
}
