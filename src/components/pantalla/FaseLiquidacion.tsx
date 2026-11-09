import type { Decision } from "@/lib/domain/types";
import type { Liquidacion } from "@/lib/api/screen.types";
import { CabeceraRonda } from "./CabeceraRonda";
import { formatearEntero, formatearMultiplicador, formatearPorcentaje } from "./formato";
import styles from "./pantalla.module.css";

const ETIQUETA_DECISION: Record<Decision, string> = {
  RESPALDA: "Respalda",
  RECHAZA: "Rechaza",
  SE_ABSTIENE: "Se abstiene",
};

const CLASE_DECISION: Record<Decision, string> = {
  RESPALDA: styles.decisionRespalda,
  RECHAZA: styles.decisionRechaza,
  SE_ABSTIENE: styles.decisionAbstencion,
};

interface FaseLiquidacionProps {
  vm: Liquidacion;
}

/*
 * Fase Liquidacion: revela los cuatro votos a la vez, el multiplicador
 * resultante y el retorno de la ronda.
 */
export function FaseLiquidacion({ vm }: FaseLiquidacionProps) {
  return (
    <>
      <CabeceraRonda ronda={vm.ronda} />
      <section aria-label="Votos revelados">
        <div className={styles.rejillaCuatro}>
          {vm.votos.map((voto) => (
            <article key={voto.jurado} className={styles.tarjeta}>
              <p className={styles.eyebrow}>{voto.jurado}</p>
              <p className={`${styles.valorTarjeta} ${CLASE_DECISION[voto.decision]}`}>
                {ETIQUETA_DECISION[voto.decision]}
              </p>
            </article>
          ))}
        </div>
      </section>
      <div className={styles.rejilla}>
        <article className={styles.tarjeta}>
          <p className={styles.eyebrow}>Multiplicador</p>
          <p className={`${styles.valorTarjeta} ${styles.acentoAmarillo}`}>
            {formatearMultiplicador(vm.multiplicador)}
          </p>
          <p className={styles.subtitulo}>
            {formatearPorcentaje(vm.fraccionRespaldo)} de respaldo entre votos emitidos
          </p>
        </article>
        <article className={styles.tarjeta}>
          <p className={styles.eyebrow}>Monto invertido</p>
          <p className={styles.valorTarjeta}>{formatearEntero(vm.montoInvertido)} IC</p>
        </article>
        <article className={styles.tarjeta}>
          <p className={styles.eyebrow}>Retorno de la ronda</p>
          <p className={`${styles.valorTarjeta} ${styles.acentoCyan}`}>
            {formatearEntero(vm.retornoRonda)} IC
          </p>
        </article>
      </div>
    </>
  );
}
