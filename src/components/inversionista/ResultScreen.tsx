import type { Decision } from "@/lib/domain/types";
import type {
  RoundInfo,
  StandingInfo,
  StartupInfo,
  VerdictInfo,
} from "@/lib/api/investor.types";
import { formatCoins, formatMultiplier, formatSignedCoins } from "./format";
import { Leaderboard } from "./Leaderboard";
import { StatusBadge } from "./StatusBadge";
import styles from "./ResultScreen.module.css";

interface ResultScreenProps {
  round: RoundInfo;
  startup: StartupInfo;
  verdict: VerdictInfo;
  standing: StandingInfo;
}

const DECISION_CLASS: Record<Decision, string> = {
  RESPALDA: "backs",
  RECHAZA: "rejects",
  SE_ABSTIENE: "abstains",
};

/** Texto de los respaldos. Las abstenciones se mencionan aparte y no cuentan en el multiplicador. */
function describeBacks(verdict: VerdictInfo): string {
  const abstentions = verdict.decisions.filter((d) => d === "SE_ABSTIENE").length;
  const base = `${verdict.backs} de ${verdict.voters} jurados respaldan`;
  if (abstentions === 0) return base;
  const plural = abstentions === 1 ? "se abstuvo" : "se abstuvieron";
  return `${base} · ${abstentions} ${plural}`;
}

/** Texto de la posición frente a la ronda anterior. */
function describePositionChange(standing: StandingInfo): { text: string; tone: string } {
  const delta = standing.previousPosition - standing.position;
  if (delta > 0) return { text: `▲ ${delta}`, tone: styles.up };
  if (delta < 0) return { text: `▼ ${Math.abs(delta)}`, tone: styles.down };
  return { text: "= igual", tone: styles.flat };
}

/** Texto que indica cuándo empieza la siguiente ronda o se cierra el evento. */
function describeWaiting(round: RoundInfo): string {
  if (round.number >= round.total) return "Esperando el cierre del evento";
  return `Esperando ronda ${round.number + 1}`;
}

/** Veredicto de la ronda: votos, multiplicador, retorno, posición y clasificación. */
export function ResultScreen({ round, startup, verdict, standing }: ResultScreenProps) {
  const gainTone =
    verdict.gain > 0 ? styles.gainUp : verdict.gain < 0 ? styles.gainDown : styles.gainFlat;
  const position = describePositionChange(standing);

  return (
    <section className={styles.screen}>
      <StatusBadge tone="cyan">Veredicto · Ronda {round.number}</StatusBadge>
      <h1 className={styles.name}>{startup.name}</h1>

      <div className={styles.votes} aria-label="Votos del jurado">
        {verdict.decisions.map((decision, index) => (
          <span key={index} className={`${styles.vote} ${styles[DECISION_CLASS[decision]]}`} />
        ))}
      </div>
      <p className={styles.backsText}>{describeBacks(verdict)}</p>

      <div className={styles.multiplierFrame}>
        <div className={styles.multiplierInner}>
          <span className={styles.label}>Multiplicador</span>
          <span className={styles.multiplier}>{formatMultiplier(verdict.multiplier)}</span>
        </div>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span className={styles.muted}>Invertiste</span>
          <span>{formatCoins(verdict.invested)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.muted}>Retorno</span>
          <span>{formatCoins(verdict.payout)}</span>
        </div>
        <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
          <span>Ganancia de la ronda</span>
          <span className={gainTone}>{formatSignedCoins(verdict.gain)}</span>
        </div>
      </div>

      <div className={styles.position}>
        <div>
          <span className={styles.label}>Tu posición</span>
          <p className={styles.positionValue}>
            #{standing.position} <span className={styles.positionOf}>de {standing.participants}</span>
          </p>
        </div>
        <span className={`${styles.positionDelta} ${position.tone}`}>{position.text}</span>
      </div>

      <Leaderboard standing={standing} />

      <div className={styles.waiting}>{describeWaiting(round)}</div>
    </section>
  );
}
