import type { Decision } from "@/shared/domain/types";
import { formatInteger, formatMultiplier } from "./format";
import type { Settlement } from "../types";
import styles from "./screen.module.css";

const DECISION_LABEL: Record<Decision, string> = {
  BACK: "Respalda",
  REJECT: "Rechaza",
  ABSTAIN: "Se abstiene",
};

const DECISION_CARD: Record<Decision, string> = {
  BACK: styles.voteBack,
  REJECT: styles.voteReject,
  ABSTAIN: styles.voteAbstain,
};

const DECISION_TEXT: Record<Decision, string> = {
  BACK: styles.accentPink,
  REJECT: "",
  ABSTAIN: styles.accentYellow,
};

/** Umbrales del multiplicador para elegir su color: alto, medio y bajo. */
const HIGH_MULTIPLIER = 1.3;
const MID_MULTIPLIER = 0.95;

interface SettlementPhaseProps {
  vm: Settlement;
}

/*
 * Fase Liquidación: revela los cuatro votos a la vez, el multiplicador resultante y el retorno de
 * la ronda. Las abstenciones no entran en el denominador del respaldo.
 */
export function SettlementPhase({ vm }: SettlementPhaseProps) {
  const backers = vm.votes.filter((vote) => vote.decision === "BACK").length;
  const emitted = vm.votes.filter((vote) => vote.decision !== "ABSTAIN").length;
  const multiplierTone =
    vm.multiplier >= HIGH_MULTIPLIER
      ? styles.multHigh
      : vm.multiplier >= MID_MULTIPLIER
        ? styles.multMid
        : styles.multLow;

  return (
    <section className={styles.column} aria-label="Liquidación de la ronda">
      <div className={styles.split}>
        <div className={styles.column}>
          <p className={styles.eyebrow}>Multiplicador</p>
          <p className={`${styles.multiplier} ${multiplierTone}`}>
            {formatMultiplier(vm.multiplier)}
          </p>
        </div>
        <div className={styles.column}>
          <h1 className={styles.title}>{vm.round.startup.name}</h1>
          <p className={styles.lead}>
            {backers} de {emitted} respaldos del jurado
          </p>
        </div>
      </div>
      <section aria-label="Votos revelados">
        <div className={styles.grid4}>
          {vm.votes.map((vote) => (
            <article key={vote.juror} className={`${styles.card} ${DECISION_CARD[vote.decision]}`}>
              <p className={styles.voteName}>{vote.juror}</p>
              <p className={`${styles.voteLabel} ${DECISION_TEXT[vote.decision]}`}>
                {DECISION_LABEL[vote.decision]}
              </p>
            </article>
          ))}
        </div>
      </section>
      <p className={styles.footnote}>
        Retorno de la ronda: {formatInteger(vm.roundReturn)} IC sobre{" "}
        {formatInteger(vm.amountInvested)} IC invertidos.
      </p>
    </section>
  );
}
