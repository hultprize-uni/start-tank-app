import type { StandingInfo } from "@/lib/api/investor.types";
import { formatCoins } from "./format";
import { Leaderboard } from "./Leaderboard";
import { StatusBadge } from "./StatusBadge";
import styles from "./FinalScreen.module.css";

interface FinalScreenProps {
  /** Saldo final del inversionista. */
  balance: number;
  standing: StandingInfo;
}

/** Cierre del evento: saldo final, posición, aciertos y clasificación. */
export function FinalScreen({ balance, standing }: FinalScreenProps) {
  return (
    <section className={styles.screen}>
      <StatusBadge tone="yellow">Fin del evento</StatusBadge>
      <h1 className={styles.title}>Gracias por invertir.</h1>

      <div className={styles.frame}>
        <div className={styles.inner}>
          <div>
            <span className={styles.label}>Saldo final</span>
            <p className={styles.balance}>{formatCoins(balance)}</p>
          </div>
          <div className={styles.metrics}>
            <div>
              <span className={styles.label}>Posición</span>
              <p className={styles.metric}>#{standing.position}</p>
            </div>
            <div>
              <span className={styles.label}>Aciertos</span>
              <p className={styles.metric}>
                {standing.hits} de {standing.hitsTotal}
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className={styles.note}>
        El ganador y el premio al mejor ojo se anuncian en la pantalla del auditorio.
      </p>

      <Leaderboard standing={standing} />
    </section>
  );
}
