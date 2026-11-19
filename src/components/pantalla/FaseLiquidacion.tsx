import type { Decision } from "@/shared/domain/types";
import type { Settlement } from "@/lib/api/screen.types";
import { RoundHeader } from "./CabeceraRonda";
import { formatInteger, formatMultiplier, formatPercentage } from "./formato";
import styles from "./pantalla.module.css";

const DECISION_LABEL: Record<Decision, string> = {
  BACK: "Respalda",
  REJECT: "Rechaza",
  ABSTAIN: "Se abstiene",
};

const DECISION_CLASS_NAME: Record<Decision, string> = {
  BACK: styles.decisionBack,
  REJECT: styles.decisionReject,
  ABSTAIN: styles.decisionAbstain,
};

interface SettlementPhaseProps {
  vm: Settlement;
}

/*
 * Fase Liquidacion: revela los cuatro votos a la vez, el multiplicador
 * resultante y el retorno de la ronda.
 */
export function SettlementPhase({ vm }: SettlementPhaseProps) {
  return (
    <>
      <RoundHeader round={vm.round} />
      <section aria-label="Votos revelados">
        <div className={styles.gridFour}>
          {vm.votes.map((vote) => (
            <article key={vote.juror} className={styles.card}>
              <p className={styles.eyebrow}>{vote.juror}</p>
              <p className={`${styles.cardValue} ${DECISION_CLASS_NAME[vote.decision]}`}>
                {DECISION_LABEL[vote.decision]}
              </p>
            </article>
          ))}
        </div>
      </section>
      <div className={styles.grid}>
        <article className={styles.card}>
          <p className={styles.eyebrow}>Multiplicador</p>
          <p className={`${styles.cardValue} ${styles.accentYellow}`}>
            {formatMultiplier(vm.multiplier)}
          </p>
          <p className={styles.subtitle}>
            {formatPercentage(vm.backingFraction)} de respaldo entre votos emitidos
          </p>
        </article>
        <article className={styles.card}>
          <p className={styles.eyebrow}>Monto invertido</p>
          <p className={styles.cardValue}>{formatInteger(vm.amountInvested)} IC</p>
        </article>
        <article className={styles.card}>
          <p className={styles.eyebrow}>Retorno de la ronda</p>
          <p className={`${styles.cardValue} ${styles.accentCyan}`}>
            {formatInteger(vm.roundReturn)} IC
          </p>
        </article>
      </div>
    </>
  );
}
