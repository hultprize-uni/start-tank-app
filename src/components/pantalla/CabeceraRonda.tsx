import type { RondaRef } from "@/lib/api/screen.types";
import styles from "./pantalla.module.css";

interface CabeceraRondaProps {
  ronda: RondaRef;
}

/** Nombre de la startup en turno, su ODS y el numero de ronda. */
export function CabeceraRonda({ ronda }: CabeceraRondaProps) {
  return (
    <section aria-label={`Ronda ${ronda.numero}`}>
      <p className={styles.eyebrow}>Ronda {ronda.numero}</p>
      <h1 className={styles.titulo}>{ronda.startup.nombre}</h1>
      <p className={styles.insignia}>
        ODS {ronda.startup.ods.numero}: {ronda.startup.ods.nombre}
      </p>
    </section>
  );
}
