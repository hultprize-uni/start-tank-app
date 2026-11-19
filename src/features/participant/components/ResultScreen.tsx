import { Badge, GradientCard } from "@/shared/ui";
import type { Decision } from "@/shared/domain/types";
import { formatCoins, formatMultiplier, formatSignedCoins } from "../format";
import type { AnnulmentMode, RoundInfo, StartupInfo, VerdictInfo } from "../types";
import styles from "./ResultScreen.module.css";

interface ResultScreenProps {
  round: RoundInfo;
  startup: StartupInfo;
  verdict: VerdictInfo;
}

/** Texto visible del voto de cada jurado. */
const DECISION_LABEL: Record<Decision, string> = {
  BACK: "Respalda",
  REJECT: "Rechaza",
  ABSTAIN: "Se abstiene",
};

/** Clase de color de cada voto en la tira de votos. */
const DECISION_CLASS: Record<Decision, string> = {
  BACK: "backs",
  REJECT: "rejects",
  ABSTAIN: "abstains",
};

/** Texto que explica una anulación según el modo elegido por el operador. */
const ANNULMENT_TEXT: Record<AnnulmentMode, string> = {
  refund: "El operador anuló la ronda. Tu inversión volvió íntegra a tu saldo.",
  "settle-1x": "El operador anuló la ronda y la liquidó a 1.0x.",
};

/** Texto de los respaldos. Las abstenciones se mencionan aparte y no cuentan en el multiplicador. */
function describeBacks(verdict: VerdictInfo): string {
  const abstentions = verdict.decisions.filter((d) => d === "ABSTAIN").length;
  const base = `${verdict.backs} de ${verdict.voters} jurados respaldan`;
  if (abstentions === 0) return base;
  const plural = abstentions === 1 ? "se abstuvo" : "se abstuvieron";
  return `${base} · ${abstentions} ${plural}`;
}

/** Texto que indica cuándo empieza la siguiente ronda o se cierra el evento. */
function describeWaiting(round: RoundInfo): string {
  if (round.number >= round.total) return "Esperando el cierre del evento";
  return `Esperando ronda ${round.number + 1}`;
}

/** Veredicto de la ronda: votos, multiplicador y retorno del asistente. Con anulación no muestra votos. */
export function ResultScreen({ round, startup, verdict }: ResultScreenProps) {
  const isAnnulled = verdict.annulment !== null;
  const gainTone =
    verdict.gain > 0 ? styles.gainUp : verdict.gain < 0 ? styles.gainDown : styles.gainFlat;

  return (
    <section className={styles.screen}>
      {isAnnulled ? (
        <Badge tone="yellow">Ronda anulada</Badge>
      ) : (
        <Badge tone="cyan">Veredicto · Ronda {round.number}</Badge>
      )}
      <h1 className={styles.name}>{startup.name}</h1>

      {isAnnulled ? (
        <p className={styles.lead}>{ANNULMENT_TEXT[verdict.annulment ?? "refund"]}</p>
      ) : (
        <>
          <ul className={styles.votes} aria-label="Votos del jurado">
            {verdict.decisions.map((decision, index) => (
              <li
                key={index}
                className={`${styles.vote} ${styles[DECISION_CLASS[decision]]}`}
              >
                <span className="visually-hidden">
                  Jurado {index + 1}: {DECISION_LABEL[decision]}
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.lead}>{describeBacks(verdict)}</p>
        </>
      )}

      <GradientCard glow panelClassName={styles.multiplierPanel}>
        <span className={styles.label}>Multiplicador</span>
        <span className={styles.multiplier}>{formatMultiplier(verdict.multiplier)}</span>
      </GradientCard>

      <dl className={styles.summary}>
        <div className={styles.row}>
          <dt className={styles.muted}>Invertiste</dt>
          <dd>{formatCoins(verdict.invested)}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.muted}>Retorno</dt>
          <dd>{formatCoins(verdict.payout)}</dd>
        </div>
        <div className={`${styles.row} ${styles.total}`}>
          <dt>Ganancia de la ronda</dt>
          <dd className={gainTone}>{formatSignedCoins(verdict.gain)}</dd>
        </div>
      </dl>

      <p className={styles.waiting}>{describeWaiting(round)}</p>
    </section>
  );
}
