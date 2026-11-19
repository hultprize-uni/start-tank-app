import { Eyebrow, GradientCard } from "@/shared/ui";
import type { JuryRoundView } from "../types";
import styles from "./StartupCard.module.css";

interface StartupCardProps {
  round: JuryRoundView;
}

/** Tarjeta de la startup en escena: nombre, objetivo de desarrollo sostenible y descripción. */
export function StartupCard({ round }: StartupCardProps) {
  return (
    <GradientCard as="section" glow panelClassName={styles.panel}>
      <Eyebrow tone="muted">Startup en escena</Eyebrow>
      <h2 className={styles.name}>{round.startupName}</h2>
      {round.sdg !== null && <p className={styles.sdg}>{round.sdg}</p>}
      {round.description !== null && <p className={styles.description}>{round.description}</p>}
    </GradientCard>
  );
}
