import type { RoundRef } from "@/lib/api/screen.types";
import styles from "./pantalla.module.css";

interface RoundHeaderProps {
  round: RoundRef;
}

/** Nombre de la startup en turno, su ODS y el numero de ronda. */
export function RoundHeader({ round: round }: RoundHeaderProps) {
  return (
    <section aria-label={`Ronda ${round.number}`}>
      <p className={styles.eyebrow}>Ronda {round.number}</p>
      <h1 className={styles.title}>{round.startup.name}</h1>
      <p className={styles.badge}>
        ODS {round.startup.sdg.number}: {round.startup.sdg.name}
      </p>
    </section>
  );
}
