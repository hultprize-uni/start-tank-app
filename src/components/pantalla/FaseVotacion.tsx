import type { Votacion } from "@/lib/api/screen.types";
import { CabeceraRonda } from "./CabeceraRonda";
import styles from "./pantalla.module.css";

interface FaseVotacionProps {
  vm: Votacion;
}

/*
 * Fase Votacion: el jurado delibera. Solo se cuentan los votos emitidos;
 * su sentido no se muestra hasta la liquidacion.
 */
export function FaseVotacion({ vm }: FaseVotacionProps) {
  const indices = Array.from({ length: vm.juradosTotal }, (_, indice) => indice);

  return (
    <>
      <CabeceraRonda ronda={vm.ronda} />
      <section>
        <p className={styles.eyebrow}>Votación en curso</p>
        <p className={styles.subtitulo}>El jurado delibera. Los votos se revelan al cierre.</p>
      </section>
      <section>
        <p className={`${styles.cifraGrande} ${styles.cifraAcento}`}>
          {vm.votosEmitidos} de {vm.juradosTotal}
        </p>
        <p className={styles.subtitulo}>votos emitidos</p>
      </section>
      <div className={styles.hileraPuntos} role="img" aria-label={`${vm.votosEmitidos} de ${vm.juradosTotal} votos emitidos`}>
        {indices.map((indice) => (
          <span
            key={indice}
            className={`${styles.punto} ${indice < vm.votosEmitidos ? styles.puntoEmitido : ""}`}
          />
        ))}
      </div>
    </>
  );
}
