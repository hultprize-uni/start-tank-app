import { Eyebrow, GradientCard } from "@/shared/ui";
import type { JuryRoundView } from "../types";
import styles from "./StartupCard.module.css";

interface StartupCardProps {
  round: JuryRoundView;
}

/** Tarjeta de la startup en escena: logotipo, nombre, objetivo de desarrollo sostenible y descripción. */
export function StartupCard({ round }: StartupCardProps) {
  return (
    <GradientCard as="section" glow panelClassName={styles.panel}>
      <div className={styles.top}>
        <div className={styles.logo} aria-hidden="true">
          {round.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logos externos de tamaño fijo
            <img src={round.logoUrl} alt="" width={52} height={52} />
          ) : (
            <span>{round.startupName.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className={styles.identity}>
          <Eyebrow tone="muted">Startup en escena</Eyebrow>
          <h2 className={styles.name}>{round.startupName}</h2>
          {round.sdg !== null && <p className={styles.sdg}>{round.sdg}</p>}
        </div>
      </div>
      {round.description !== null && <p className={styles.description}>{round.description}</p>}
    </GradientCard>
  );
}
