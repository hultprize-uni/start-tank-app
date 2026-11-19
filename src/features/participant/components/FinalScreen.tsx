import { Badge, GradientCard } from "@/shared/ui";
import { formatCoins } from "../format";
import type { StandingInfo } from "../types";
import styles from "./FinalScreen.module.css";

interface FinalScreenProps {
  /** Saldo final del inversionista. */
  balance: number;
  standing: StandingInfo;
}

/** Cierre del evento: saldo final, posición y aciertos. La clasificación completa va en el panel lateral. */
export function FinalScreen({ balance, standing }: FinalScreenProps) {
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

      <p className={styles.note}>
        El ganador y el premio al mejor ojo se anuncian en la pantalla del auditorio.
      </p>
    </section>
  );
}
