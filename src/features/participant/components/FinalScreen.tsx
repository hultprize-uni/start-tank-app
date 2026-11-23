import { Badge, GradientCard } from "@/shared/ui";
import { formatCoins } from "../format";
import type { StandingInfo } from "../types";
import styles from "./FinalScreen.module.css";

interface FinalScreenProps {
  /** Saldo final del inversionista. */
  balance: number;
  standing: StandingInfo;
  /** Startup ganadora, si el cierre del evento ya la calculó. */
  winnerStartup: string | null;
}

/** Cierre del evento (RF-30): saldo final, posición, aciertos y startup ganadora. */
export function FinalScreen({ balance, standing, winnerStartup }: FinalScreenProps) {
  return (
    <section className={styles.screen}>
      <Badge tone="yellow">Fin del evento</Badge>
      <h1 className={styles.title}>Gracias por invertir.</h1>

      <GradientCard panelClassName={styles.panel}>
        <div>
          <span className={styles.label}>Saldo final</span>
          <p className={styles.balance}>{formatCoins(balance)}</p>
        </div>
        <dl className={styles.metrics}>
          <div>
            <dt className={styles.label}>Posición</dt>
            <dd className={styles.metric}>#{standing.position}</dd>
          </div>
          <div>
            <dt className={styles.label}>Aciertos</dt>
            <dd className={styles.metric}>
              {standing.hits} de {standing.hitsTotal}
            </dd>
          </div>
        </dl>
      </GradientCard>

      {winnerStartup !== null ? (
        <p className={styles.note}>
          Startup ganadora: <strong>{winnerStartup}</strong>
        </p>
      ) : (
        <p className={styles.note}>
          La startup ganadora y el premio al mejor ojo se anuncian en la pantalla del auditorio.
        </p>
      )}
    </section>
  );
}
